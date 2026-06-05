import { requireAuthenticatedUserFromRequest } from "lib/auth";
import {
  addSocialComment,
  getSocialState,
  toggleSocialLike
} from "lib/db";

export const dynamic = "force-dynamic";

function validateContent(contentType, contentId) {
  const validTypes = new Set(["vod", "live"]);
  if (!validTypes.has(contentType) || !contentId) {
    return false;
  }
  return true;
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const contentType = url.searchParams.get("contentType") || "";
    const contentId = url.searchParams.get("contentId") || "";
    if (!validateContent(contentType, contentId)) {
      return Response.json({ error: "Invalid content target." }, { status: 400 });
    }

    const state = await getSocialState({
      contentType,
      contentId,
      userId: auth.user.id
    });

    return Response.json({
      ...state,
      currentUser: {
        username: auth.user.username,
        displayName: auth.user.displayName
      }
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to load social data.", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUserFromRequest(request);
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const action = body?.action || "";
    const contentType = body?.contentType || "";
    const contentId = body?.contentId || "";

    if (!validateContent(contentType, contentId)) {
      return Response.json({ error: "Invalid content target." }, { status: 400 });
    }

    if (action === "toggle-like") {
      const state = await toggleSocialLike({
        contentType,
        contentId,
        userId: auth.user.id
      });
      return Response.json(state);
    }

    if (action === "comment") {
      const commentBody = String(body?.body || "").trim();
      if (!commentBody) {
        return Response.json({ error: "Comment cannot be empty." }, { status: 400 });
      }

      const state = await addSocialComment({
        contentType,
        contentId,
        userId: auth.user.id,
        body: commentBody.slice(0, 500)
      });
      return Response.json(state);
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: "Failed to update social data.", details: error.message },
      { status: 500 }
    );
  }
}
