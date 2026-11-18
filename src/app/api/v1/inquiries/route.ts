import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonCreated, jsonOk, readJson } from "@/lib/http";
import { createInquiry, listInquiriesForUser } from "@/lib/inquiries/service";
import { createInquirySchema } from "@/lib/validation/inquiries";

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "inquiry:manage_own");
    const items = await listInquiriesForUser(session.user);
    return jsonOk({ inquiries: items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission(request, "inquiry:create");
    const body = await readJson(request, createInquirySchema);
    const inquiry = await createInquiry(session.user, body);
    return jsonCreated({ inquiry });
  } catch (error) {
    return handleRouteError(error);
  }
}
