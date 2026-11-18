import { requireApiSession, getSessionFromCookies } from "@/lib/auth/service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { searchWithViewerFavorites } from "@/lib/favorites/service";
import { parseSearchParams } from "@/lib/validation/search";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = parseSearchParams(url.searchParams);

    let viewer = null;
    try {
      viewer = await requireApiSession(request);
    } catch {
      try {
        viewer = await getSessionFromCookies();
      } catch {
        viewer = null;
      }
    }

    const result = await searchWithViewerFavorites(query, viewer?.user ?? null);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
