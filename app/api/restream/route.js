import { requireAuthenticatedUserFromRequest } from "lib/auth";
import { getOwnedStreamByKey, updateOwnedStreamRestreamConfig } from "lib/db";
import { getRestreamTargetsForStream, startRestreamWorkers, stopRestreamWorkers } from "lib/restream-worker";
import { reloadNginx, writeRestreamTargets } from "lib/restream";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const streamKey = (body.streamKey || "").trim();
    const youtubeKey = (body.youtubeKey || "").trim();
    const facebookKey = (body.facebookKey || "").trim();

    if (!streamKey) {
      return Response.json(
        { applied: false, error: "Missing stream key." },
        { status: 400 }
      );
    }

    const existingStream = await getOwnedStreamByKey(auth.user.id, streamKey);
    if (!existingStream) {
      return Response.json(
        {
          applied: false,
          error: "Stream not found."
        },
        { status: 404 }
      );
    }

    const updatedStream = await updateOwnedStreamRestreamConfig(
      auth.user.id,
      streamKey,
      youtubeKey,
      facebookKey
    );
    const targets = getRestreamTargetsForStream(updatedStream);
    let nginxWarning = "";

    try {
      await writeRestreamTargets({ youtubeKey: "", facebookKey: "" });
      await reloadNginx();
    } catch (error) {
      nginxWarning = `Không thể dọn cấu hình push cũ của Nginx: ${error.message}`;
    }

    if (updatedStream?.status === "live") {
      await stopRestreamWorkers(streamKey);
      await startRestreamWorkers(updatedStream);
    }

    return Response.json({
      applied: true,
      streamKey,
      targets,
      mode: "ffmpeg-worker",
      warning: nginxWarning,
      message: updatedStream?.status === "live"
        ? "Restream config đã được cập nhật và worker đã restart."
        : "Restream config đã được lưu. Worker sẽ tự chạy khi stream publish."
    });
  } catch (error) {
    return Response.json(
      {
        applied: false,
        error: "Failed to apply restream targets.",
        details: error.message
      },
      { status: 500 }
    );
  }
}
