import { requireApiPermission, toPublicUser, updateOwnProfile } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { updateProfileSchema } from "@/lib/validation/auth";

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "profile:read_own");
    return jsonOk({ user: toPublicUser(session.user) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireApiPermission(request, "profile:update_own");
    const body = await readJson(request, updateProfileSchema);
    const user = await updateOwnProfile(session.user.id, body);
    return jsonOk({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    return handleRouteError(error);
  }
}
