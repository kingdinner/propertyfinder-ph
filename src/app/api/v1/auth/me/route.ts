import { requireApiSession, toPublicUser } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    return jsonOk({ user: toPublicUser(session.user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
