import { getStreamByKey, updateStreamStatus } from "lib/db";
import { startAdaptiveLiveTranscode } from "lib/live-adaptive";
import { startRestreamWorkers } from "lib/restream-worker";

function extractStreamKey(body) {
  return body?.name || body?.stream || "";
}

export async function POST(request) {
  try {
    const body = await request.formData();
    const payload = Object.fromEntries(body.entries());
    const streamKey = extractStreamKey(payload);

    if (!streamKey) {
      return new Response("Missing stream key.", { status: 400 });
    }

    const stream = await getStreamByKey(streamKey);
    if (!stream) {
      return new Response("Unknown stream key.", { status: 403 });
    }

    await updateStreamStatus(streamKey, "live");
    await startAdaptiveLiveTranscode(streamKey);
    await startRestreamWorkers(stream);
    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Failed to process publish callback.", { status: 500 });
  }
}
