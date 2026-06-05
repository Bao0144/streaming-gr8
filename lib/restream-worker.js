import { existsSync, mkdirSync, promises as fsPromises } from "fs";
import { join } from "path";
import { spawn } from "child_process";

const ROOT_DIR = process.cwd();
const PID_DIR = join(ROOT_DIR, "run", "restream-workers");

function ensureRuntimeDirs() {
  if (!existsSync(PID_DIR)) {
    mkdirSync(PID_DIR, { recursive: true });
  }
}

function pidFilePath(streamKey, provider) {
  return join(PID_DIR, `${streamKey}.${provider}.pid`);
}

function logFilePath(streamKey, provider) {
  return join(PID_DIR, `${streamKey}.${provider}.log`);
}

async function readPid(streamKey, provider) {
  try {
    const content = await fsPromises.readFile(pidFilePath(streamKey, provider), "utf8");
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

function buildTargets(stream) {
  const targets = [];

  if (stream?.restreamYoutube) {
    targets.push({
      provider: "youtube",
      url: `rtmp://a.rtmp.youtube.com/live2/${stream.restreamYoutube.trim()}`
    });
  }

  if (stream?.restreamFacebook) {
    targets.push({
      provider: "facebook",
      url: `rtmps://live-api-s.facebook.com:443/rtmp/${stream.restreamFacebook.trim()}`
    });
  }

  return targets;
}

async function startProviderWorker(streamKey, provider, outputUrl) {
  ensureRuntimeDirs();

  const existingPid = await readPid(streamKey, provider);
  if (await isProcessRunning(existingPid)) {
    return { started: false, provider, reason: "already-running", pid: existingPid };
  }

  const inputUrl = `rtmp://127.0.0.1:1935/live/${streamKey}`;
  const logFd = await fsPromises.open(logFilePath(streamKey, provider), "a");
  const ffmpegCommand = [
    "sleep 2;",
    "exec ffmpeg -y -loglevel error -nostats",
    `-i "${inputUrl}"`,
    "-map 0:v:0 -map 0:a?",
    "-c:v libx264 -preset veryfast -pix_fmt yuv420p -g 48 -keyint_min 48 -sc_threshold 0",
    "-c:a aac -b:a 128k -ar 44100 -ac 2",
    `-f flv "${outputUrl}"`
  ].join(" ");

  const child = spawn("bash", ["-lc", ffmpegCommand], {
    cwd: ROOT_DIR,
    detached: true,
    stdio: ["ignore", logFd.fd, logFd.fd]
  });

  child.unref();
  await fsPromises.writeFile(pidFilePath(streamKey, provider), String(child.pid), "utf8");
  await logFd.close();

  return { started: true, provider, pid: child.pid, url: outputUrl };
}

async function stopProviderWorker(streamKey, provider) {
  const pid = await readPid(streamKey, provider);
  if (!pid) {
    return { stopped: false, provider, reason: "missing-pid" };
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // ignore stale pid
  }

  try {
    await fsPromises.unlink(pidFilePath(streamKey, provider));
  } catch {
    // ignore
  }

  return { stopped: true, provider, pid };
}

export function getRestreamTargetsForStream(stream) {
  return buildTargets(stream);
}

export async function startRestreamWorkers(stream) {
  const targets = buildTargets(stream);
  if (!stream?.streamKey || targets.length === 0) {
    return { started: [], skipped: true };
  }

  const started = [];
  for (const target of targets) {
    started.push(await startProviderWorker(stream.streamKey, target.provider, target.url));
  }

  return { started, skipped: false };
}

export async function stopRestreamWorkers(streamKey) {
  const providers = ["youtube", "facebook"];
  const stopped = [];

  for (const provider of providers) {
    stopped.push(await stopProviderWorker(streamKey, provider));
  }

  return { stopped };
}
