import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonCreated, readJson } from "@/lib/http";
import { createListingReport, createReportSchema } from "@/lib/reports/service";

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission(request, "report:create");
    const body = await readJson(request, createReportSchema);
    const report = await createListingReport(session.user, body);
    return jsonCreated({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}
