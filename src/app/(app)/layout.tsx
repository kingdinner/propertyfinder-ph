import { AuthenticatedShell } from "@/components/layout/Shells";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
