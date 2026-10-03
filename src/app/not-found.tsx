import Link from "next/link";
import { Compass, Home, LogIn, Sparkles } from "lucide-react";
import { Card } from "@/components/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[85vh] items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center border border-[var(--color-border)] shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] mb-4">
          <Compass size={28} />
        </div>
        <p className="text-4xl font-bold tracking-tight text-[var(--color-primary)]">404</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--color-foreground)]">Page Not Found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
          The page or resource you are looking for does not exist, may have moved, or requires signing in with an active account.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Home size={14} />
            Back to Dashboard
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            <LogIn size={14} />
            Sign In
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            <Sparkles size={14} />
            Plans
          </Link>
        </div>
      </Card>
    </div>
  );
}

