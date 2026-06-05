import { existsSync, mkdirSync, promises as fsPromises } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const ROOT_DIR = process.cwd();
const HLS_DIR = join(ROOT_DIR, "data", "hls");
const PID_DIR = join(ROOT_DIR, "run", "adaptive-live");

function ensureRuntimeDirs() {
  if (!existsSync(HLS_DIR)) {
    mkdirSync(HLS_DIR, { recursive: true });
  }

  if (!existsSync(PID_DIR)) {
    mkdirSync(PID_DIR, { recursive: true });
  }
}

function pidFilePath(streamKey) {
  return join(PID_DIR, `${streamKey}.pid`);
}

function logFilePath(streamKey) {
  return join(PID_DIR, `${streamKey}.log`);
}

async function readPid(streamKey) {
  try {
    const content = await fsPromises.readFile(pidFilePath(streamKey), "utf8");
    const pid = Number(content.trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function startAdaptiveLiveTranscode(streamKey) {
  ensureRuntimeDirs();

  const existingPid = await readPid(streamKey);
  if (await isProcessRunning(existingPid)) {
    return { started: false, reason: "already-running", pid: existingPid };
  }

  const streamDir = join(HLS_DIR, streamKey);
  if (!existsSync(streamDir)) {
    mkdirSync(streamDir, { recursive: true });
  }

  const logFd = await fsPromises.open(logFilePath(streamKey), "a");
  const inputUrl = `rtmp://127.0.0.1:1935/live/${streamKey}`;
  const outputPattern = join(streamDir, "%v.m3u8");
  const segmentPattern = join(streamDir, "%v_segment_%03d.ts");
  const ffmpegCommand = [
    "sleep 2;",
    "exec ffmpeg -y -loglevel error -nostats",
    `-i "${inputUrl}"`,
    '-filter_complex "[0:v]split=3[v240][v480][v720];[v240]scale=w=-2:h=240[v240out];[v480]scale=w=-2:h=480[v480out];[v720]scale=w=-2:h=720[v720out]"',
    "-map [v240out] -map 0:a:0",
    "-map [v480out] -map 0:a:0",
    "-map [v720out] -map 0:a:0",
    "-c:v libx264 -preset ultrafast -threads 1 -profile:v baseline -g 48 -keyint_min 48 -sc_threshold 0",
    "-b:v:0 400k -maxrate:v:0 500k -bufsize:v:0 800k",
    "-b:v:1 1000k -maxrate:v:1 1200k -bufsize:v:1 1500k",
    "-b:v:2 2500k -maxrate:v:2 2800k -bufsize:v:2 3500k",
    "-c:a aac -ar 48000 -ac 2 -b:a 128k",
    "-f hls -hls_time 3 -hls_list_size 6",
    "-hls_flags independent_segments+delete_segments+append_list+omit_endlist",
    `-hls_segment_filename "${segmentPattern}"`,
    '-master_pl_name master.m3u8',
    '-var_stream_map "v:0,a:0,name:240p v:1,a:1,name:480p v:2,a:2,name:720p"',
    `"${outputPattern}"`
  ].join(" ");

  const child = spawn("bash", ["-lc", ffmpegCommand], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ["ignore", logFd.fd, logFd.fd]
  });

  child.unref();
  await fsPromises.writeFile(pidFilePath(streamKey), String(child.pid), "utf8");
  await logFd.close();

  return { started: true, pid: child.pid };
}

export async function stopAdaptiveLiveTranscode(streamKey) {
  const pid = await readPid(streamKey);
  if (!pid) {
    return { stopped: false, reason: "missing-pid" };
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // ignore stale pid
  }

  try {
    await fsPromises.unlink(pidFilePath(streamKey));
  } catch {
    // ignore
  }

  return { stopped: true, pid };
}
