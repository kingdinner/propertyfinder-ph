import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { getInquiry } from "@/lib/inquiries/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "inquiry:manage_own");
    const { id } = await params;
    const inquiry = await getInquiry(session.user, id);
    return jsonOk({ inquiry });
  } catch (error) {
    return handleRouteError(error);
  }
}
