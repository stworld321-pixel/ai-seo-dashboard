import { cn } from "@/lib/format";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  empty = "No data",
  getKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  getKey: (row: T, i: number) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">{empty}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: c.width }}
                className={cn(
                  "px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]",
                  c.align === "right"
                    ? "text-right"
                    : c.align === "center"
                      ? "text-center"
                      : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((row, i) => (
            <tr key={getKey(row, i)} className="hover:bg-[var(--color-surface-muted)]">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-5 py-2.5",
                    c.align === "right" && "text-right tabular",
                    c.align === "center" && "text-center",
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
