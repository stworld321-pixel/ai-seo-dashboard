import { Card } from "@/components/card";

export function EmptyState({
  title,
  message,
  command = "npm run sync:lite",
}: {
  title: string;
  message: string;
  command?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{message}</p>
        <pre className="mt-4 rounded-md bg-[var(--color-surface-muted)] p-3 text-left text-xs">
          {command}
        </pre>
      </Card>
    </div>
  );
}

export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description ? (
        <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
      ) : null}
    </div>
  );
}
