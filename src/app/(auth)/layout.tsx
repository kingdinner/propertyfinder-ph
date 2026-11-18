import { AuthSplit } from "@/components/layout/AuthSplit";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplit>{children}</AuthSplit>;
}
