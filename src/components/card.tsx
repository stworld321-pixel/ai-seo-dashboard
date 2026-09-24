import { cn } from "@/lib/format";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
