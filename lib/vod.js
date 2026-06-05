import {
  copyFile,
  existsSync,
  mkdirSync,
  rmSync,
  promises as fsPromises
} from "fs";
import { basename, extname, join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getVodAssetMetadataByFileName, listVodAssetsMetadata, upsertVodAsset } from "lib/db";

const execFileAsync = promisify(execFile);
const copyFileAsync = promisify(copyFile);
const ROOT_DIR = process.cwd();
const VIDEOS_DIR = join(ROOT_DIR, "videos");
const VOD_DATA_DIR = join(ROOT_DIR, "data", "vod");
const RECORDS_DIR = join(ROOT_DIR, "data", "records");
const HLS_BASE_URL = process.env.NEXT_PUBLIC_HLS_BASE_URL || "http://localhost:8080";
const SUPPORTED_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v"]);

// Chuẩn hóa tên thành slug để dùng làm output folder, id VOD, và path HLS.
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function sanitizeBasename(value) {
  const normalized = slugify(value || "");
  return normalized || `vod-${randomSuffix()}`;
}

function prettifyTitle(value) {
  const normalized = String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "Untitled video";
  }

  return normalized.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function formatArchiveTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function parseArchiveTitle(baseName) {
  const match = baseName.match(/^(.*)-(\d{8}-\d{6})$/);
  if (!match) {
    return null;
  }

  const [, streamKey, timestamp] = match;
  return {
    streamKey,
    timestamp,
    label: "Livestream archive"
  };
}

function inferStreamKeyFromRecordingName(fileName) {
  const baseName = fileName.replace(extname(fileName), "");
  const match = baseName.match(/^(.*)-\d+$/);
  return match?.[1] || baseName;
}

function buildRtmpVodUrl(fileName) {
  const extension = extname(fileName).toLowerCase();
  const streamPath = extension === ".mp4" ? `mp4:${fileName}` : fileName;
  return `rtmp://localhost:1935/vod/${streamPath}`;
}

async function ensureDirectories() {
  // /videos chứa file media nguồn hoặc file archive cuối cùng.
  if (!existsSync(VIDEOS_DIR)) {
    mkdirSync(VIDEOS_DIR, { recursive: true });
  }

  // /data/vod chứa asset playback đã đóng gói: m3u8, ts, poster.
  if (!existsSync(VOD_DATA_DIR)) {
    mkdirSync(VOD_DATA_DIR, { recursive: true });
  }
}

async function generateVodAssets(localFilePath, outputName) {
  // Tạo HLS VOD và poster cho một file local đã sẵn sàng đưa vào thư viện.
  const scriptPath = join(ROOT_DIR, "scripts", "generate-vod-hls.sh");
  await execFileAsync(scriptPath, [localFilePath, outputName], {
    cwd: ROOT_DIR,
    maxBuffer: 20 * 1024 * 1024
  });
  await ensureVodPoster(localFilePath, outputName);
}

async function validateMediaFile(filePath) {
  try {
    await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ], {
      cwd: ROOT_DIR,
      maxBuffer: 1024 * 1024
    });
    return true;
  } catch {
    return false;
  }
}

async function buildVodPlaybackOptions(outputName) {
  const outputDir = join(VOD_DATA_DIR, outputName);
  const masterPath = join(outputDir, "master.m3u8");
  const variants = [
    { id: "240p", label: "240p", file: "240p.m3u8" },
    { id: "480p", label: "480p", file: "480p.m3u8" },
    { id: "720p", label: "720p", file: "720p.m3u8" }
  ];

  if (existsSync(masterPath)) {
    // Nếu có master playlist, UI sẽ hiện chế độ adaptive + chọn quality cụ thể.
    const availableVariants = variants
      .filter((variant) => existsSync(join(outputDir, variant.file)))
      .map((variant) => ({
        id: variant.id,
        label: variant.label,
        path: `/vod/${outputName}/${variant.file}`
      }));

    return {
      hasAdaptive: true,
      options: [
        {
          id: "auto",
          label: "Auto",
          path: `/vod/${outputName}/master.m3u8`
        },
        ...availableVariants
      ]
    };
  }

  return {
    // Nếu không có adaptive, dùng index.m3u8 làm đường phát chuẩn/fallback.
    hasAdaptive: false,
    options: [
      {
        id: "standard",
        label: "Chuẩn",
        path: `/vod/${outputName}/index.m3u8`
      }
    ]
  };
}

export async function listVodLibrary() {
  await ensureDirectories();

  // Metadata trong DB chỉ là lớp nghiệp vụ; file system vẫn là nguồn sự thật của media asset.
  const metadataRows = await listVodAssetsMetadata();
  const metadataByFileName = new Map(metadataRows.map((row) => [row.fileName, row]));

  const entries = await fsPromises.readdir(VIDEOS_DIR, {
    withFileTypes: true
  });

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map(async (entry) => {
        const filePath = join(VIDEOS_DIR, entry.name);
        const fileStat = await fsPromises.stat(filePath);
        const baseName = entry.name.replace(extname(entry.name), "");
        const metadata = metadataByFileName.get(entry.name);
        const outputName = metadata?.outputName || sanitizeBasename(baseName);
        const archiveMeta = parseArchiveTitle(baseName);
        const standardPlaylistPath = join(VOD_DATA_DIR, outputName, "index.m3u8");

        // Chỉ hiện video trong thư viện nếu tối thiểu đã có HLS VOD hợp lệ.
        if (!existsSync(standardPlaylistPath)) {
          return null;
        }

        // Poster được tạo lười: nếu chưa có thì sinh lúc scan thư viện.
        await ensureVodPoster(filePath, outputName);
        const playback = await buildVodPlaybackOptions(outputName);
        return {
          id: outputName,
          title: prettifyTitle(metadata?.title || baseName),
          fileName: entry.name,
          size: fileStat.size,
          updatedAt: fileStat.mtime.toLocaleString("vi-VN"),
          rtmpUrl: buildRtmpVodUrl(entry.name),
          hlsUrl: `/vod/${outputName}/index.m3u8`,
          hlsPlayback: playback,
          posterUrl: `${HLS_BASE_URL}/vod/${outputName}/poster.jpg`,
          isArchive: Boolean(archiveMeta),
          archiveMeta,
          authorDisplayName: metadata?.ownerDisplayName || "",
          authorUsername: metadata?.ownerUsername || "",
          ownerUserId: metadata?.ownerUserId || null,
          sourceType: metadata?.sourceType || (archiveMeta ? "archive" : "upload")
        };
      })
  );

  return files
    .filter(Boolean)
    .sort((left, right) => right.fileName.localeCompare(left.fileName));
}

export async function syncRecordingArchivesToLibrary() {
  // Đồng bộ các recording MP4 đã có trong /data/records vào thư viện VOD.
  // Luồng này hữu ích khi archive được tạo sau live nhưng chưa kịp xuất hiện trong /videos.
  if (!existsSync(RECORDS_DIR)) {
    return;
  }

  const entries = await fsPromises.readdir(RECORDS_DIR, {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (extension !== ".mp4") {
      continue;
    }

    const recordingPath = join(RECORDS_DIR, entry.name);
    const streamKey = inferStreamKeyFromRecordingName(entry.name);
    try {
      await archiveRecordingToVodLibrary(recordingPath, streamKey);
    } catch {
      continue;
    }
  }
}

export async function deleteVodFileFromLibrary(fileName) {
  await ensureDirectories();
  const metadata = await getVodAssetMetadataByFileName(fileName);
  const extension = extname(fileName).toLowerCase();
  const baseName = fileName.replace(extension, "");
  const outputName = metadata?.outputName || sanitizeBasename(baseName);

  await fsPromises.unlink(join(VIDEOS_DIR, fileName)).catch(() => {});
  rmSync(join(VOD_DATA_DIR, outputName), { recursive: true, force: true });

  // Xóa cả file media nguồn lẫn thư mục HLS tương ứng để tránh asset mồ côi.
  return {
    fileName,
    outputName
  };
}

export async function archiveRecordingToVodLibrary(recordingPath, streamKey, ownerUserId = null) {
  if (!recordingPath || !streamKey) {
    throw new Error("Missing recording path or stream key.");
  }

  await ensureDirectories();

  const stats = await fsPromises.stat(recordingPath);
  const sourceExtension = extname(recordingPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(sourceExtension)) {
    throw new Error("Unsupported recording format.");
  }

  const archiveBaseName = sanitizeBasename(
    `${streamKey}-${formatArchiveTimestamp(stats.mtime)}`
  );
  const fileName = `${archiveBaseName}${sourceExtension}`;
  const localFilePath = join(VIDEOS_DIR, fileName);
  const playlistPath = join(VOD_DATA_DIR, archiveBaseName, "index.m3u8");

  // Nếu cả file archive và playlist HLS đã tồn tại, chỉ cần xác minh lại rồi tái dùng.
  if (existsSync(localFilePath) && existsSync(playlistPath)) {
    const isValid = await validateMediaFile(localFilePath);
    if (!isValid) {
      await fsPromises.unlink(localFilePath).catch(() => {});
      rmSync(join(VOD_DATA_DIR, archiveBaseName), { recursive: true, force: true });
    } else {
      await upsertVodAsset({
        fileName,
        outputName: archiveBaseName,
        title: archiveBaseName,
        ownerUserId,
        sourceType: "archive"
      });
      return {
        fileName,
        outputName: archiveBaseName,
        localFilePath,
        hlsUrl: `http://localhost:8080/vod/${archiveBaseName}/index.m3u8`,
        rtmpUrl: buildRtmpVodUrl(fileName)
      };
    }
  }

  if (existsSync(localFilePath)) {
    const isValid = await validateMediaFile(localFilePath);
    if (!isValid) {
      await fsPromises.unlink(localFilePath).catch(() => {});
    }
  }

  if (existsSync(join(VOD_DATA_DIR, archiveBaseName)) && !existsSync(playlistPath)) {
    // Thư mục HLS dở dang không có index.m3u8 được xem là output lỗi, cần xóa để build lại sạch.
    rmSync(join(VOD_DATA_DIR, archiveBaseName), { recursive: true, force: true });
  }

  const recordingIsValid = await validateMediaFile(recordingPath);
  if (!recordingIsValid) {
    throw new Error(`Recording archive is invalid: ${recordingPath}`);
  }

  if (existsSync(localFilePath) && existsSync(playlistPath)) {
    await upsertVodAsset({
      fileName,
      outputName: archiveBaseName,
      title: archiveBaseName,
      ownerUserId,
      sourceType: "archive"
    });
    return {
      fileName,
      outputName: archiveBaseName,
      localFilePath,
      hlsUrl: `http://localhost:8080/vod/${archiveBaseName}/index.m3u8`,
      rtmpUrl: buildRtmpVodUrl(fileName)
    };
  }

  await copyFileAsync(recordingPath, localFilePath);
  await generateVodAssets(localFilePath, archiveBaseName);
  await upsertVodAsset({
    fileName,
    outputName: archiveBaseName,
    title: archiveBaseName,
    ownerUserId,
    sourceType: "archive"
  });

  return {
    fileName,
    outputName: archiveBaseName,
    localFilePath,
    hlsUrl: `http://localhost:8080/vod/${archiveBaseName}/index.m3u8`,
    rtmpUrl: buildRtmpVodUrl(fileName)
  };
}

export async function deleteArchivedVodByStreamKey(streamKey) {
  if (!streamKey) {
    return { deleted: [] };
  }

  await ensureDirectories();

  const entries = await fsPromises.readdir(VIDEOS_DIR, {
    withFileTypes: true
  });
  const deleted = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    const baseName = entry.name.replace(extension, "");
    const archiveMeta = parseArchiveTitle(baseName);
    if (!archiveMeta || archiveMeta.streamKey !== streamKey) {
      continue;
    }

    const videoPath = join(VIDEOS_DIR, entry.name);
    await fsPromises.unlink(videoPath).catch(() => {});
    rmSync(join(VOD_DATA_DIR, sanitizeBasename(baseName)), { recursive: true, force: true });
    deleted.push(entry.name);
  }

  return { deleted };
}

async function ensureVodPoster(videoFilePath, outputName) {
  const outputDir = join(VOD_DATA_DIR, outputName);
  const posterPath = join(outputDir, "poster.jpg");

  // Poster là asset giao diện; nếu đã có thì không tạo lại.
  if (existsSync(posterPath)) {
    return posterPath;
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  try {
    await execFileAsync("ffmpeg", [
      "-v",
      "error",
      "-nostats",
      "-y",
      "-ss",
      "00:00:01",
      "-i",
      videoFilePath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      posterPath
    ], {
      cwd: ROOT_DIR
    });
  } catch {
    return null;
  }

  return posterPath;
}
