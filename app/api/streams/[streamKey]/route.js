import { requireAuthenticatedUserFromRequest } from "lib/auth";
import { deleteOwnedStreamByKey, getOwnedStreamByKey, updateStreamStatus } from "lib/db";
import { fetchActiveLiveStreamKeys } from "lib/stats";

export const dynamic = "force-dynamic";

function toStreamResponse(stream) {
  return {
    ...stream,
    publishServer: "rtmp://localhost:1935/live",
    watchPath: `/watch/${stream.watchSlug || stream.streamKey}`,
    playlistPath: `/hls/${stream.streamKey}/index.m3u8`
  };
}

export async function GET(request, { params }) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const stream = await getOwnedStreamByKey(auth.user.id, params.streamKey);

    if (!stream) {
      return Response.json({ error: "Stream not found." }, { status: 404 });
    }

    return Response.json({
      ...toStreamResponse(stream)
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch stream.", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const stream = await getOwnedStreamByKey(auth.user.id, params.streamKey);
    if (!stream) {
      return Response.json({ error: "Stream not found." }, { status: 404 });
    }

    if (stream.status === "live") {
      const activeLiveKeys = await fetchActiveLiveStreamKeys();
      if (activeLiveKeys.has(stream.streamKey)) {
        return Response.json(
          { error: "Không thể xóa stream đang live." },
          { status: 409 }
        );
      }

      await updateStreamStatus(stream.streamKey, "ended");
    }

    const result = await deleteOwnedStreamByKey(auth.user.id, params.streamKey);
    return Response.json({
      deleted: result.deleted,
      streamKey: params.streamKey
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to delete stream.", details: error.message },
      { status: 500 }
    );
  }
}
