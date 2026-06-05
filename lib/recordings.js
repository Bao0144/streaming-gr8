import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";

const ROOT_DIR = process.cwd();
const RECORDS_DIR = path.join(ROOT_DIR, "data", "records");
const RECORDING_LOG_DIR = path.join(ROOT_DIR, "run", "recordings");
const execFileAsync = promisify(execFile);

function ensureRecordingDirs() {
  // /data/records chứa recording gốc và file đã remux sang mp4 nếu có.
  if (!existsSync(RECORDS_DIR)) {
    mkdirSync(RECORDS_DIR, { recursive: true });
  }

  // /run/recordings chứa log ffmpeg khi remux để tiện debug hậu kỳ.
  if (!existsSync(RECORDING_LOG_DIR)) {
    mkdirSync(RECORDING_LOG_DIR, { recursive: true });
  }
}

function baseNameWithoutExt(fileName) {
  return fileName.replace(path.extname(fileName), "");
}

function formatRecordingEntry(fileName, stats, converted = false) {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = baseNameWithoutExt(fileName);

  return {
    id: baseName,
    name: fileName,
    title: baseName,
    size: stats.size,
    updatedAt: stats.mtime.toISOString(),
    url: `/records/${encodeURIComponent(fileName)}`,
    extension,
    converted,
    playableInBrowser: extension === ".mp4"
  };
}

async function readRecordingFiles() {
  ensureRecordingDirs();
  const entries = await fs.readdir(RECORDS_DIR, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(RECORDS_DIR, entry.name);
    const stats = await fs.stat(fullPath);
    files.push({
      name: entry.name,
      fullPath,
      stats
    });
  }

  return files;
}

export async function listRecordings() {
  const files = await readRecordingFiles();
  return files
    // UI recording hiện chỉ ưu tiên các file đã remux xong sang mp4.
    .filter((file) => file.name.endsWith(".mp4"))
    .map((file) => formatRecordingEntry(file.name, file.stats, true))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

async function waitForStableFile(filePath, attempts = 6, intervalMs = 1000) {
  let previousSize = -1;

  // Chờ file FLV ngừng tăng kích thước trước khi đưa vào ffmpeg remux.
  // Mục tiêu là tránh remux khi Nginx vẫn còn đang flush dữ liệu cuối.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const stats = await fs.stat(filePath);
    if (stats.size > 0 && stats.size === previousSize) {
      return;
    }

    previousSize = stats.size;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function remuxFlvToMp4(flushPath) {
  const outputPath = flushPath.replace(/\.flv$/i, ".mp4");
  if (existsSync(outputPath)) {
    // Nếu mp4 đầu ra đã có và ffprobe xác nhận hợp lệ thì bỏ qua để tránh làm lại.
    const isValid = await validateMediaFile(outputPath);
    if (isValid) {
      return { skipped: true, outputPath, outputName: path.basename(outputPath) };
    }

    await fs.unlink(outputPath).catch(() => {});
  }

  await waitForStableFile(flushPath);

  const logPath = path.join(RECORDING_LOG_DIR, `${path.basename(flushPath)}.log`);
  const logHandle = await fs.open(logPath, "a");

  return new Promise((resolve, reject) => {
    // Remux bằng -c copy để đổi container nhanh, không phải transcode lại nội dung.
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        flushPath,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        outputPath
      ],
      {
        cwd: ROOT_DIR,
        stdio: ["ignore", logHandle.fd, logHandle.fd]
      }
    );

    ffmpeg.on("error", async (error) => {
      await logHandle.close();
      reject(error);
    });

    ffmpeg.on("close", async (code) => {
      await logHandle.close();

      if (code === 0) {
        const isValid = await validateMediaFile(outputPath);
        if (!isValid) {
          // Nếu ffmpeg thoát 0 nhưng file kết quả vẫn không hợp lệ, xóa để tránh dùng nhầm.
          await fs.unlink(outputPath).catch(() => {});
          reject(new Error("Generated MP4 is invalid or incomplete."));
          return;
        }

        resolve({
          skipped: false,
          outputPath,
          outputName: path.basename(outputPath)
        });
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

export async function convertRecordings({ streamKey } = {}) {
  const files = await readRecordingFiles();
  const flvCandidates = files.filter((file) => {
    if (!file.name.endsWith(".flv")) {
      return false;
    }

    if (file.stats.size === 0) {
      return false;
    }

    if (!streamKey) {
      return true;
    }

    // Có thể remux toàn bộ hoặc chỉ remux recording của một stream cụ thể.
    return file.name.startsWith(`${streamKey}-`);
  });

  const converted = [];
  const skipped = [];
  const failed = [];

  for (const candidate of flvCandidates.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs)) {
    try {
      const result = await remuxFlvToMp4(candidate.fullPath);
      if (result.skipped) {
        skipped.push({
          name: candidate.name,
          outputName: result.outputName,
          outputPath: result.outputPath
        });
      } else {
        converted.push({
          name: candidate.name,
          outputName: result.outputName,
          outputPath: result.outputPath
        });
      }
    } catch (error) {
      failed.push({
        name: candidate.name,
        error: error.message
      });
    }
  }

  return {
    converted,
    skipped,
    failed
  };
}

export async function deleteRecordingsForStream(streamKey) {
  if (!streamKey) {
    return { deleted: [] };
  }

  const files = await readRecordingFiles();
  const deleted = [];

  for (const file of files) {
    if (!file.name.startsWith(`${streamKey}-`)) {
      continue;
    }

    await fs.unlink(file.fullPath).catch(() => {});
    deleted.push(file.name);
  }

  return { deleted };
}
