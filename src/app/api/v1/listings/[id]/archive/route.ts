import { archiveListing } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const { id } = await params;
    const listing = await archiveListing(session.user, id);
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
