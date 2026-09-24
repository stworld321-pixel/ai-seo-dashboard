import Link from "next/link";
import { Card } from "@/components/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center">
        <p className="text-4xl font-semibold text-[var(--color-primary)]">404</p>
        <h1 className="mt-2 text-lg font-semibold">Page not built yet</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This section is on the roadmap but has no implementation. Sidebar items that
          are not yet built appear greyed out.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]"
        >
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
