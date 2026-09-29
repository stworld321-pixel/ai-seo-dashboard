"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import type { ContentScoreReport } from "@/server/intelligence/content-scorer";

type PageOption = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  keyword: string;
};

export function ContentOptimizerClient({
  websiteId,
  pages,
}: {
  websiteId: string;
  pages: PageOption[];
}) {
  const router = useRouter();
  const initial = pages[0];
  const [url, setUrl] = useState(initial?.url ?? "");
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [title, setTitle] = useState(
    initial?.title ?? "",
  );
  const [metaDescription, setMetaDescription] = useState(
    initial?.metaDescription ?? "",
  );
  const [contentBody, setContentBody] = useState(
    "",
  );
  const [report, setReport] = useState<ContentScoreReport | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSelectPage(selectedUrl: string) {
    setUrl(selectedUrl);
    const found = pages.find((p) => p.url === selectedUrl);
    if (found) {
      setKeyword(found.keyword);
      setTitle(found.title ?? "");
      setMetaDescription(found.metaDescription ?? "");
    }
  }

  async function runScorer(queueApproval: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/content/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          url,
          keyword,
          title,
          metaDescription,
          contentBody,
          queueApproval,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setReport(json.data.report);
        setApprovalId(json.data.approvalId ?? null);
        if (queueApproval) router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title="On-Page SEO Editor"
          subtitle="Score title, Rank Math meta description, and body copy against your target keyword"
        />
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Target Page URL
              </label>
              <select
                value={url}
                onChange={(e) => handleSelectPage(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                {pages.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.url}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Primary Focus Keyword
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                SEO Title (`rank_math_title`)
              </label>
              <span className="font-mono text-[11px] text-[var(--color-muted)]">
                {title.length} / 65 chars
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Meta Description (`rank_math_description`)
              </label>
              <span className="font-mono text-[11px] text-[var(--color-muted)]">
                {metaDescription.length} / 160 chars
              </span>
            </div>
            <textarea
              rows={2}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">
              Page Body Copy (Markdown / HTML)
            </label>
            <textarea
              rows={7}
              value={contentBody}
              onChange={(e) => setContentBody(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => runScorer(false)}
              disabled={loading}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Scoring..." : "Score Content & Run QA Check"}
            </button>
            <button
              type="button"
              onClick={() => runScorer(true)}
              disabled={loading}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            >
              Queue Rank Math Meta Update for Approval
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Live SEO Score & QA Checks"
          subtitle={report ? `${report.score}/100 points` : "Click 'Score Content' to evaluate"}
          action={
            report ? (
              <StatusBadge
                status={report.qaPassed ? "QA Passed" : "Needs Fixes"}
                tone={report.qaPassed ? "success" : "warning"}
              />
            ) : null
          }
        />
        <div className="space-y-3 p-5">
          {approvalId ? (
            <div className="rounded-md bg-[var(--color-success-bg)] px-3 py-2 text-xs text-[var(--color-success)]">
              Queued in Approvals (`{approvalId}`). Review and approve in Automation → Activity.
            </div>
          ) : null}

          {report ? (
            <>
              <div className="space-y-2">
                {report.checks.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{c.label}</span>
                      <span
                        className={
                          c.passed ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                        }
                      >
                        {c.points}/{c.maxPoints}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{c.detail}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-md bg-[var(--color-surface-muted)] p-3 text-xs">
                <p className="font-semibold">Suggested Title:</p>
                <p className="mt-0.5 text-[var(--color-muted)]">{report.suggestedTitle}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTitle(report.suggestedTitle);
                    setMetaDescription(report.suggestedMeta);
                  }}
                  className="mt-2 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  Apply suggested title & meta
                </button>
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-xs text-[var(--color-muted)]">
              Run the scorer to inspect title pixel length, focus keyword placement, heading
              hierarchy, FAQ coverage, keyword stuffing ceiling (≤ 3.5%), and unsourced statistic
              guards.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
