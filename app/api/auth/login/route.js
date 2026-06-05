import { getUserByUsername } from "lib/db";
import { NextResponse } from "next/server";

const DEMO_AUTH_COOKIE = "demo_user";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return Response.json(
        { error: "Vui lòng nhập tên đăng nhập và mật khẩu." },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(username);
    if (!user || user.password !== password) {
      return Response.json(
        { error: "Sai tên đăng nhập hoặc mật khẩu." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      }
    });

    response.cookies.set(DEMO_AUTH_COOKIE, user.username, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch (error) {
    return Response.json(
      { error: "Không thể đăng nhập.", details: error.message },
      { status: 500 }
    );
  }
}
