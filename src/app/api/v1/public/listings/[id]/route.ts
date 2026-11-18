import { requireApiSession } from "@/lib/auth/service";
import { handleRouteError, jsonOk, jsonError } from "@/lib/http";
import { getPublishedListing } from "@/lib/search/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    let viewerUserId: string | undefined;
    try {
      const session = await requireApiSession(request);
      viewerUserId = session.user.id;
    } catch {
      viewerUserId = undefined;
    }
    const listing = await getPublishedListing(id, { viewerUserId });
    if (!listing) return jsonError(404, "not_found", "Listing not found");
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
