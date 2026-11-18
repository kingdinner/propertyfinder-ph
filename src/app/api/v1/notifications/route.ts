import { requireApiSession } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { listNotificationsForUser, markNotificationRead } from "@/lib/notifications/service";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(request);
    const items = await listNotificationsForUser(session.user.id);
    return jsonOk({ notifications: items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession(request);
    const body = z.object({ id: z.string().uuid() }).parse(await request.json());
    await markNotificationRead(session.user.id, body.id);
    return jsonOk({ read: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
