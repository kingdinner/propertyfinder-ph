import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";

/** Protected probe used to verify unauthorized API access is rejected. */
export async function GET(request: Request) {
  try {
    await requireApiPermission(request, "admin:suspend_user");
    return jsonOk({ secure: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
