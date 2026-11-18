import { decideModeration } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { moderationDecisionSchema } from "@/lib/validation/listings";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "listing:moderate");
    const { id } = await params;
    const body = await readJson(request, moderationDecisionSchema);
    const listing = await decideModeration(session.user, id, body);
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
