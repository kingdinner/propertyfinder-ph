import { addListingImage } from "@/lib/listings/service";
import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, jsonError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError(400, "validation_error", "file is required");
    }
    const listing = await addListingImage(session.user, id, file);
    return jsonOk({ listing });
  } catch (error) {
    return handleRouteError(error);
  }
}
