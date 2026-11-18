import { requireApiPermission, suspendUser, toPublicUser } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { suspendUserSchema } from "@/lib/validation/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await requireApiPermission(request, "admin:suspend_user");
    const body = await readJson(request, suspendUserSchema);
    const user = await suspendUser(session.user, id, body.reason);
    return jsonOk({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    return handleRouteError(error);
  }
}
