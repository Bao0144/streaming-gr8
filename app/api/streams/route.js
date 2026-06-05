import { requireAuthenticatedUserFromRequest } from "lib/auth";
import {
  createStream,
  getStreamByKey,
  listLiveStreams,
  listStreamsByUser,
  updateStreamStatus
} from "lib/db";
import { fetchActiveLiveStreamKeys } from "lib/stats";

function toStreamResponse(stream) {
  return {
    ...stream,
    publishServer: "rtmp://localhost:1935/live",
    watchPath: `/watch/${stream.watchSlug || stream.streamKey}`,
    playlistPath: `/hls/${stream.streamKey}/index.m3u8`
  };
}

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

function buildStreamKey(title, customKey) {
  const normalizedCustomKey = slugify(customKey || "");
  if (normalizedCustomKey) {
    return normalizedCustomKey;
  }

  const titleSlug = slugify(title || "");
  return titleSlug ? `${titleSlug}-${randomSuffix()}` : `stream-${randomSuffix()}`;
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const title = (body.title || "Untitled stream").trim();
    const streamKey = buildStreamKey(title, body.customKey);
    const restreamYoutube =
      (body.restreamYoutubeKey || body.restreamYoutube || "").trim();
    const restreamFacebook =
      (body.restreamFacebookKey || body.restreamFacebook || "").trim();
    const recordEnabled = body.recordEnabled !== false;

    const existing = await getStreamByKey(streamKey);
    if (existing) {
      return Response.json(
        { error: "Stream key already exists. Choose another custom key." },
        { status: 409 }
      );
    }

    const stream = await createStream({
      userId: auth.user.id,
      title,
      streamKey,
      recordEnabled,
      restreamYoutube,
      restreamFacebook
    });

    return Response.json({
      ...toStreamResponse(stream)
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to create stream.", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }
    const streams = await listStreamsByUser(auth.user.id);
    const activeLiveKeys = await fetchActiveLiveStreamKeys();
    const staleLiveKeys = new Set();

    for (const stream of streams) {
      if (stream.status === "live" && !activeLiveKeys.has(stream.streamKey)) {
        staleLiveKeys.add(stream.streamKey);
      }
    }

    const globalLiveStreams = await listLiveStreams();
    for (const stream of globalLiveStreams) {
      if (!activeLiveKeys.has(stream.streamKey)) {
        staleLiveKeys.add(stream.streamKey);
      }
    }

    await Promise.all([...staleLiveKeys].map((streamKey) => updateStreamStatus(streamKey, "ended")));

    const [refreshedStreams, availableRooms] = await Promise.all([
      listStreamsByUser(auth.user.id),
      listLiveStreams()
    ]);

    return Response.json({
      streams: refreshedStreams.map(toStreamResponse),
      availableRooms: availableRooms.map(toStreamResponse)
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to list streams.", details: error.message },
      { status: 500 }
    );
  }
}
