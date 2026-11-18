import { toPublicUser, verifyEmail } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { verifyEmailSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, verifyEmailSchema);
    const user = await verifyEmail(body);
    return jsonOk({ user: user ? toPublicUser(user) : null });
  } catch (error) {
    return handleRouteError(error);
  }
}
