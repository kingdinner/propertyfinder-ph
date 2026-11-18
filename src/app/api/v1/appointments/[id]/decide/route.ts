import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { decideAppointment } from "@/lib/inquiries/service";
import { appointmentDecisionSchema } from "@/lib/validation/inquiries";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireApiPermission(request, "appointment:manage");
    const { id } = await params;
    const body = await readJson(request, appointmentDecisionSchema);
    const appointment = await decideAppointment(session.user, id, body);
    return jsonOk({ appointment });
  } catch (error) {
    return handleRouteError(error);
  }
}
