import { submitListing } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { listingSubmitSchema } from "@/lib/validation/listings";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const { id } = await params;
    const text = await request.text();
    const body = text ? listingSubmitSchema.parse(JSON.parse(text)) : undefined;
    const listing = await submitListing(session.user, id, body, "submit");
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
