import { cookies } from "next/headers";
import { getUserByUsername } from "lib/db";

export const DEMO_AUTH_COOKIE = "demo_user";

export async function getAuthenticatedUser() {
  const cookieStore = cookies();
  const username = cookieStore.get(DEMO_AUTH_COOKIE)?.value || "";

  if (!username) {
    return null;
  }

  return getUserByUsername(username);
}

export async function getAuthenticatedUserFromRequest(request) {
  const username = request.cookies.get(DEMO_AUTH_COOKIE)?.value || "";

  if (!username) {
    return null;
  }

  return getUserByUsername(username);
}

export async function requireAuthenticatedUserFromRequest(request) {
  const user = await getAuthenticatedUserFromRequest(request);

  if (!user) {
    return {
      user: null,
      response: Response.json({ error: "Unauthorized." }, { status: 401 })
    };
  }

  return { user, response: null };
}
