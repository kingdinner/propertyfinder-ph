import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { resolveListingReport, resolveReportSchema } from "@/lib/reports/service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "admin:manage_reports");
    const { id } = await params;
    const body = await readJson(request, resolveReportSchema);
    const report = await resolveListingReport(session.user, id, body);
    return jsonOk({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}
