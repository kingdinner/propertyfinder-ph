import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/service";
import { getAgentDashboard } from "@/lib/dashboard/service";
import { handleRouteError, jsonOk } from "@/lib/http";

const querySchema = z.object({
  tab: z.enum(["listings", "inquiries", "appointments"]).default("listings"),
  listingStatus: z.string().optional(),
  inquiryStatus: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "listing:manage_own");
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const data = await getAgentDashboard(session.user, query);
    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
