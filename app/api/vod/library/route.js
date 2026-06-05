import { requireAuthenticatedUserFromRequest } from "lib/auth";
import { deleteVodAssetMetadata, getVodAssetMetadataByFileName } from "lib/db";
import { deleteVodFileFromLibrary, listVodLibrary, syncRecordingArchivesToLibrary } from "lib/vod";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const shouldSync = new URL(request.url).searchParams.get("sync") === "1";
    await syncRecordingArchivesToLibrary();

    const videos = await listVodLibrary();
    return Response.json({ videos, synced: shouldSync });
  } catch (error) {
    return Response.json(
      { error: error.message || "Không thể đọc thư viện VOD." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const fileName = String(body?.fileName || "").trim();
    if (!fileName) {
      return Response.json({ error: "Missing file name." }, { status: 400 });
    }

    const metadata = await getVodAssetMetadataByFileName(fileName);
    if (!metadata) {
      return Response.json({ error: "Video metadata not found." }, { status: 404 });
    }

    const canDelete = auth.user.username === "admin" || metadata.ownerUserId === auth.user.id;
    if (!canDelete) {
      return Response.json({ error: "Bạn không có quyền xóa video này." }, { status: 403 });
    }

    await deleteVodFileFromLibrary(fileName);
    await deleteVodAssetMetadata(fileName, metadata.outputName);

    return Response.json({ deleted: true, fileName });
  } catch (error) {
    return Response.json(
      { error: error.message || "Không thể xóa video." },
      { status: 500 }
    );
  }
}
