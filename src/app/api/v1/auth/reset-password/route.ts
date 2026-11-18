import { resetPassword } from "@/lib/auth/service";
import { handleRouteError, jsonOk, readJson } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, resetPasswordSchema);
    await resetPassword(body);
    return jsonOk({ message: "Password updated. You can sign in with your new password." });
  } catch (error) {
    return handleRouteError(error);
  }
}
