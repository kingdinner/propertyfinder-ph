import { z } from "zod";
import { requireApiPermission } from "@/lib/auth/service";
import { getAdminDashboard } from "@/lib/dashboard/service";
import { handleRouteError, jsonOk } from "@/lib/http";

const querySchema = z.object({
  tab: z.enum(["moderation", "listings", "users", "agents", "reports", "analytics"]).default("moderation"),
  listingStatus: z.string().optional(),
  reportStatus: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "portal:admin");
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const data = await getAdminDashboard(session.user, query);
    return jsonOk(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
