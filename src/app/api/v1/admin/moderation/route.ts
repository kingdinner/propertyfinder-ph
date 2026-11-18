import { listModerationQueue, listRecentDecisions } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "listing:moderate");
    const [queue, decisions] = await Promise.all([
      listModerationQueue(session.user),
      listRecentDecisions(session.user),
    ]);
    return jsonOk({ queue, decisions });
  } catch (error) {
    return handleRouteError(error);
  }
}
