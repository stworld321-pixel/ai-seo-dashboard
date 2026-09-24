"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";

const RANGES = [
  { key: "7d", label: "7 days" },
  { key: "28d", label: "28 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "12m", label: "12 months" },
] as const;

export function RangePicker({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function select(key: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", key);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => select(r.key)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            current === r.key
              ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
