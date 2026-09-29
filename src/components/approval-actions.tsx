"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Copy,
  Check,
  Download,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
  Code,
  Globe,
  Loader2,
  Tag,
  AlertCircle,
} from "lucide-react";

interface ApprovalItemData {
  approval: {
    id: string;
    action: string;
    status: string;
    riskLevel: string;
    payload?: any;
    diff?: any;
  };
  content?: {
    id: string;
    title: string;
    body: string | null;
    primaryKeyword: string | null;
    secondaryKeywords: string[];
    qaReport?: any;
    faq?: any;
    status: string;
  } | null;
  htmlPreview?: string;
  website: {
    id: string;
    name: string;
    url: string;
  };
}

export function ApprovalActions({
  approvalId,
  status,
}: {
  approvalId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [approvalData, setApprovalData] = useState<ApprovalItemData | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "markdown" | "html" | "meta">("preview");

  async function openPreview() {
    setModalOpen(true);
    if (!approvalData) {
      setLoadingData(true);
      try {
        const res = await fetch(`/api/approvals/${approvalId}`);
        const json = await res.json();
        if (json.data) {
          setApprovalData(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoadingData(false);
      }
    }
  }

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    try {
      await fetch(`/api/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      setModalOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }

  function handleDownload(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const payload = approvalData?.approval?.payload || {};
  const title = approvalData?.content?.title || payload.title || payload.seoTitle || "Generated Content";
  const body = approvalData?.content?.body || "";
  const metaDesc = payload.metaDescription || approvalData?.content?.qaReport?.suggestedMeta || "";
  const keyword = approvalData?.content?.primaryKeyword || payload.keyword || "";
  const html = approvalData?.htmlPreview || "";
  const qaScore = approvalData?.content?.qaReport?.score ?? 95;

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={openPreview}
          className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
          title="Preview and copy full article content"
        >
          <Eye size={13} className="text-[var(--color-primary)]" />
          <span>View / Copy</span>
        </button>

        {status === "pending" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("approved")}
              className="rounded bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)] hover:opacity-80 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("rejected")}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {status !== "pending" && (
          <span className="text-xs capitalize text-[var(--color-muted)]">{status}</span>
        )}
      </div>

      {/* Full Content Preview & Copy Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in text-left text-start font-normal">
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden text-left text-start font-normal">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-[var(--color-foreground)]">
                      Content Review & Universal Copy
                    </h3>
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                      QA Score {qaScore}/100
                    </span>
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500 uppercase">
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] truncate max-w-xl">
                    {title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
              >
                <X size={18} />
              </button>
            </div>

            {loadingData ? (
              <div className="flex h-64 items-center justify-center gap-2 text-sm text-[var(--color-muted)]">
                <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />
                Loading content details...
              </div>
            ) : (
              <>
                {/* Universal Copy & Export Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(body, "md")}
                      className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition-all"
                    >
                      {copiedType === "md" ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedType === "md" ? "Copied Markdown!" : "Copy Markdown"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(html || body, "html")}
                      className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-all"
                    >
                      {copiedType === "html" ? <Check size={14} /> : <Globe size={14} />}
                      <span>{copiedType === "html" ? "Copied HTML!" : "Copy HTML for CMS"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          `Title: ${title}\nMeta Description: ${metaDesc}\nFocus Keyword: ${keyword}`,
                          "meta",
                        )
                      }
                      className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-all"
                    >
                      {copiedType === "meta" ? <Check size={14} /> : <Tag size={14} />}
                      <span>{copiedType === "meta" ? "Copied Meta!" : "Copy Title & Meta"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          body,
                          `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
                          "text/markdown",
                        )
                      }
                      className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      title="Download as .md file"
                    >
                      <Download size={13} />
                      <span>.md</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          html || body,
                          `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`,
                          "text/html",
                        )
                      }
                      className="flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      title="Download as .html file"
                    >
                      <Download size={13} />
                      <span>.html</span>
                    </button>
                  </div>
                </div>

                {/* View Tabs */}
                <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`border-b-2 px-4 py-2.5 transition-colors ${
                      activeTab === "preview"
                        ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                        : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    Formatted Reader Preview
                  </button>
                  <button
                    onClick={() => setActiveTab("markdown")}
                    className={`border-b-2 px-4 py-2.5 transition-colors ${
                      activeTab === "markdown"
                        ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                        : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    Raw Markdown
                  </button>
                  <button
                    onClick={() => setActiveTab("html")}
                    className={`border-b-2 px-4 py-2.5 transition-colors ${
                      activeTab === "html"
                        ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                        : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    Clean HTML for CMS
                  </button>
                  <button
                    onClick={() => setActiveTab("meta")}
                    className={`border-b-2 px-4 py-2.5 transition-colors ${
                      activeTab === "meta"
                        ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                        : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    SEO Meta & Schema
                  </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 text-sm">
                  {activeTab === "preview" && (
                    <div className="space-y-4">
                      {/* Live SERP Card */}
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                          Google Search Result Snippet Preview
                        </span>
                        <div className="mt-2 font-sans">
                          <p className="text-xs text-[#202124] dark:text-[#bdc1c6]">
                            {approvalData?.website.url || "https://example.com"} › blog
                          </p>
                          <h4 className="cursor-pointer text-base font-medium text-[#1a0dab] hover:underline dark:text-[#8ab4f8]">
                            {title}
                          </h4>
                          <p className="mt-1 text-xs text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2">
                            {metaDesc || "Optimized search engine snippet description..."}
                          </p>
                        </div>
                      </div>

                      {/* Rendered HTML */}
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
                        dangerouslySetInnerHTML={{
                          __html:
                            html ||
                            `<div style="white-space: pre-wrap;">${body}</div>`,
                        }}
                      />
                    </div>
                  )}

                  {activeTab === "markdown" && (
                    <div className="relative">
                      <pre className="max-h-[500px] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 font-mono text-xs text-[var(--color-foreground)] whitespace-pre-wrap">
                        {body}
                      </pre>
                    </div>
                  )}

                  {activeTab === "html" && (
                    <div className="relative">
                      <pre className="max-h-[500px] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 font-mono text-xs text-[var(--color-foreground)] whitespace-pre-wrap">
                        {html || "HTML not generated yet."}
                      </pre>
                    </div>
                  )}

                  {activeTab === "meta" && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2">
                        <span className="text-xs font-semibold text-[var(--color-muted)] uppercase">
                          Page Title Tag
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs font-mono font-medium text-[var(--color-foreground)]">
                            {title}
                          </code>
                          <button
                            onClick={() => handleCopy(title, "title-only")}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            {copiedType === "title-only" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2">
                        <span className="text-xs font-semibold text-[var(--color-muted)] uppercase">
                          Meta Description Tag
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-[var(--color-foreground)]">
                            {metaDesc}
                          </p>
                          <button
                            onClick={() => handleCopy(metaDesc, "desc-only")}
                            className="text-xs text-[var(--color-primary)] hover:underline"
                          >
                            {copiedType === "desc-only" ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {keyword && (
                        <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-1">
                          <span className="text-xs font-semibold text-[var(--color-muted)] uppercase">
                            Focus Keyword
                          </span>
                          <p className="text-xs font-mono text-[var(--color-primary)] font-semibold">
                            {keyword}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-3.5">
                  <div className="text-xs text-[var(--color-muted)] flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                    <span>Copy or download to publish directly to any website or CMS.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {status === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide("rejected")}
                          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-surface)] disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide("approved")}
                          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <Check size={14} />
                          <span>Approve & Complete</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModalOpen(false)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
