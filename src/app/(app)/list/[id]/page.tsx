import { notFound, redirect } from "next/navigation";
import { ListingWizard } from "@/components/listings/ListingWizard";
import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/service";
import { getManagedListing } from "@/lib/listings/service";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/rbac";

type Params = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Params) {
  const { id } = await params;
  try {
    const session = await requireSession(getDb());
    const listing = await getManagedListing(session.user, id, getDb());
    return <ListingWizard initial={listing} />;
  } catch (error) {
    if (error instanceof AuthenticationError) redirect(`/login?next=/list/${id}`);
    if (error instanceof AuthorizationError) redirect("/dashboard?forbidden=1");
    notFound();
  }
}
