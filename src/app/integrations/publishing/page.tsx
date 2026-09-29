import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import { ManualExportPanel } from "@/components/manual-export-panel";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { Globe, GitBranch, Server, FileCode, CheckCircle2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublishingIntegrationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (!ctx) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-muted)]">
        {reason === "no-website" ? "No website configured." : `No data for ${websiteName ?? "website"}.`}
      </div>
    );
  }

  const { website, window, range } = ctx;

  const publishingConns = await prisma.publishingConnection.findMany({
    where: { websiteId: website.id },
  });

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
        websiteId={website.id}
      />

      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Publishing &amp; Deployment</h1>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Configure how approved articles, schema markups, and SEO metadata are deployed to your website.
          </p>
        </div>

        {/* 1. WordPress REST API */}
        <Card>
          <CardHeader
            title="WordPress REST API Connector"
            subtitle="Sync drafts, update SEO titles/descriptions, and manage categories"
            action={<StatusBadge status={process.env.WP_APP_PASSWORD ? "Configured" : "Not Set"} tone={process.env.WP_APP_PASSWORD ? "positive" : "neutral"} />}
          />
          <div className="p-5 space-y-3 text-xs">
            <p className="text-[var(--color-foreground)]">
              Connects directly via WordPress Application Passwords. Allows creating drafts and updating Rank Math / Yoast SEO metadata upon human approval.
            </p>
            <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-muted)]">
              <span>Site URL: {website.url}</span>
              <span>·</span>
              <span>User: {process.env.WP_USERNAME || "digito2412@gmail.com"}</span>
            </div>
          </div>
        </Card>

        {/* 2. GitHub Pull Request Workflow */}
        <Card>
          <CardHeader
            title="GitHub Pull Request Workflow (Next.js / React / Markdown)"
            subtitle="Creates isolated branches and opens Pull Requests for developer code review"
            action={<StatusBadge status="Available" tone="info" />}
          />
          <div className="p-5 space-y-3 text-xs">
            <p className="text-[var(--color-foreground)]">
              Ideal for custom-coded websites. The Article Agent generates formatted Markdown/MDX files, pushes them to a new Git branch, and opens a GitHub Pull Request.
            </p>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-1 font-mono text-[11px]">
              <p>1. SaaS generates: <code>content/blog/best-organic-handmade-soap.md</code></p>
              <p>2. Git Branch: <code>seo-content/best-organic-handmade-soap</code></p>
              <p>3. Pull Request created on GitHub → Developer merges → Deploys on Vercel/Netlify</p>
            </div>
          </div>
        </Card>

        {/* 3. Custom Webhook / API */}
        <Card>
          <CardHeader
            title="Custom Deployment Webhook / API"
            subtitle="POST structured JSON payloads to your custom backend or CMS endpoint"
            action={<StatusBadge status="Ready" tone="neutral" />}
          />
          <div className="p-5 space-y-3 text-xs">
            <p className="text-[var(--color-foreground)]">
              Dispatches authenticated HTTP POST requests containing article titles, content HTML/Markdown, metadata, and JSON-LD schema upon approval.
            </p>
          </div>
        </Card>

        {/* 4. Manual Export */}
        <Card>
          <CardHeader
            title="Manual Export &amp; Copy"
            subtitle="Zero credentials required — instantly copy or download generated assets"
          />
          <div className="p-5">
            <ManualExportPanel />
          </div>
        </Card>
      </div>
    </>
  );
}
