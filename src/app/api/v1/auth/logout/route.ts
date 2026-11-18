import { logoutSession, requireApiSession, SESSION_COOKIE } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(request);
    await logoutSession(session.claims.sid);
    const response = jsonOk({ loggedOut: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
