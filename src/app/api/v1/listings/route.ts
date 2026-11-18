import { createDraftListing, listOwnListings } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonCreated, jsonOk, readJson } from "@/lib/http";
import { listingDraftSchema } from "@/lib/validation/listings";

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const data = await listOwnListings(session.user);
    return jsonOk({ listings: data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission(request, "listing:create");
    const body = await readJson(request, listingDraftSchema);
    const listing = await createDraftListing(session.user, body);
    return jsonCreated({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
