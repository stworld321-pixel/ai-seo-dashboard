"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  FileText,
  Gauge,
  Globe,
  Link2,
  Search,
  Settings,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/format";

type Item = { href: string; label: string; icon?: React.ElementType; soon?: boolean };
type Group = { label?: string; items: Item[] };

/**
 * Sidebar per docs/08. Routes not yet built are marked `soon` and render as
 * disabled — visible roadmap, but never a link that 404s.
 */
const GROUPS: Group[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: Gauge },
      { href: "/websites", label: "Websites", icon: Globe },
    ],
  },
  {
    label: "Performance",
    items: [
      { href: "/performance/search-console", label: "Search Console", icon: Search },
      { href: "/performance/analytics", label: "Analytics", icon: BarChart3, soon: true },
    ],
  },
  {
    label: "SEO Intelligence",
    items: [
      { href: "/seo/keywords", label: "Keywords", icon: Target },
      { href: "/seo/opportunities", label: "Opportunities", icon: Sparkles },
      { href: "/seo/pages", label: "Pages", icon: FileText },
      { href: "/seo/technical", label: "Technical SEO", icon: Wrench, soon: true },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/content/library", label: "Content Library", icon: FileText, soon: true },
      { href: "/content/generator", label: "Blog Generator", icon: Sparkles, soon: true },
      { href: "/content/optimizer", label: "Optimizer", icon: Wrench, soon: true },
      { href: "/content/internal-links", label: "Internal Links", icon: Link2, soon: true },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/automation/daily-agent", label: "Daily SEO Agent", icon: Bot, soon: true },
      { href: "/automation/activity", label: "Activity", icon: Activity, soon: true },
    ],
  },
  {
    items: [{ href: "/settings", label: "Settings", icon: Settings, soon: true }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-xs font-bold text-[var(--color-primary-fg)]">
          AI
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">SEO Command</p>
          <p className="text-[10px] text-[var(--color-muted)]">Growth Platform</p>
        </div>
      </div>

      <nav className="px-3 py-4">
        {GROUPS.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {group.label ? (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;

                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <span
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-[var(--color-muted)]/60"
                        title="Not built yet"
                      >
                        {Icon ? <Icon size={15} /> : null}
                        {item.label}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-[var(--color-primary)] font-medium text-[var(--color-primary-fg)]"
                          : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]",
                      )}
                    >
                      {Icon ? <Icon size={15} /> : null}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
