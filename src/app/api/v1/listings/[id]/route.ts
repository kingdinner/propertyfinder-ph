import { getManagedListing, updateListingDraft } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { listingDraftSchema } from "@/lib/validation/listings";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const { id } = await params;
    const listing = await getManagedListing(session.user, id);
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const { id } = await params;
    const body = await readJson(request, listingDraftSchema);
    const listing = await updateListingDraft(session.user, id, body);
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
