import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { replyToInquiry } from "@/lib/inquiries/service";
import { replyInquirySchema } from "@/lib/validation/inquiries";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "inquiry:manage_own");
    const { id } = await params;
    const body = await readJson(request, replyInquirySchema);
    const inquiry = await replyToInquiry(session.user, id, body);
    return jsonOk({ inquiry });
  } catch (error) {
    return handleRouteError(error);
  }
}
