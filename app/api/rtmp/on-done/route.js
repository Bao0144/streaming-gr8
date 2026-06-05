import { getStreamByKey, updateStreamStatus } from "lib/db";
import { stopAdaptiveLiveTranscode } from "lib/live-adaptive";
import { stopRestreamWorkers } from "lib/restream-worker";
import { convertRecordings, deleteRecordingsForStream } from "lib/recordings";
import { archiveRecordingToVodLibrary, deleteArchivedVodByStreamKey } from "lib/vod";

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
      return new Response("Unknown stream key.", { status: 404 });
    }

    await updateStreamStatus(streamKey, "ended");
    await stopAdaptiveLiveTranscode(streamKey);
    await stopRestreamWorkers(streamKey);

    if (!stream.recordEnabled) {
      await deleteRecordingsForStream(streamKey);
      await deleteArchivedVodByStreamKey(streamKey);
      return new Response("OK", { status: 200 });
    }

    const conversionResult = await convertRecordings({ streamKey });

    for (const recording of [
      ...(conversionResult.converted || []),
      ...(conversionResult.skipped || [])
    ]) {
      if (!recording?.outputPath) {
        continue;
      }

      await archiveRecordingToVodLibrary(recording.outputPath, streamKey, stream.userId || null);
    }

    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Failed to process done callback.", { status: 500 });
  }
}
