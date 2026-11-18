import { requestPasswordReset } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, forgotPasswordSchema);
    await requestPasswordReset(body);
    return jsonOk({
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
