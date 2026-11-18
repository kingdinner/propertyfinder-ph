import { requireApiPermission } from "@/lib/auth/service";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites/service";
import { handleRouteError, jsonOk, jsonCreated } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  listingId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiPermission(request, "favorite:manage");
    const items = await listFavorites(session.user);
    return jsonOk({ favorites: items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiPermission(request, "favorite:manage");
    const body = bodySchema.parse(await request.json());
    const result = await addFavorite(session.user, body.listingId);
    return jsonCreated(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireApiPermission(request, "favorite:manage");
    const url = new URL(request.url);
    const listingId = url.searchParams.get("listingId");
    const parsed = bodySchema.parse({ listingId });
    const result = await removeFavorite(session.user, parsed.listingId);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
