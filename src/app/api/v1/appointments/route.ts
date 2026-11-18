import { requireApiPermission } from "@/lib/auth/service";
import { handleRouteError, jsonCreated, jsonOk, readJson } from "@/lib/http";
import { createAppointment, listAppointmentsForUser } from "@/lib/inquiries/service";
import { createAppointmentSchema } from "@/lib/validation/inquiries";

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "appointment:manage");
    const items = await listAppointmentsForUser(session.user);
    return jsonOk({ appointments: items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission(request, "appointment:manage");
    const body = await readJson(request, createAppointmentSchema);
    const appointment = await createAppointment(session.user, body);
    return jsonCreated({ appointment });
  } catch (error) {
    return handleRouteError(error);
  }
}
