import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { reviewAgentLicense, reviewLicenseSchema } from "@/lib/reports/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "admin:review_license");
    const { id } = await params;
    const body = await readJson(request, reviewLicenseSchema);
    const profile = await reviewAgentLicense(session.user, id, body);
    return jsonOk({ profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
