"use client";

import { useState } from "react";
import { Eye, Copy, Check, Download, FileText, X, Globe, Tag } from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  slug: string | null;
  body: string | null;
  primaryKeyword: string | null;
  status: string;
  qaReport?: any;
  faq?: any;
}

export function ContentLibraryRowActions({
  content,
  websiteUrl,
}: {
  content: ContentItem;
  websiteUrl?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "markdown" | "meta">("preview");

  function handleCopy(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }

  function handleDownload(contentStr: string, filename: string, mimeType: string) {
    const blob = new Blob([contentStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const title = content.title;
  const body = content.body || "";
  const keyword = content.primaryKeyword || "";
  const metaDesc = content.qaReport?.suggestedMeta || "";
  const qaScore = content.qaReport?.score ?? 92;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
      >
        <Eye size={13} className="text-[var(--color-primary)]" />
        <span>View / Copy</span>
      </button>

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
                    <h3 className="font-semibold text-sm text-[var(--color-foreground)]">{title}</h3>
                    <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                      QA {qaScore}/100
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    Target Keyword: {keyword || "—"}
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

            {/* Universal Copy Toolbar */}
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
                Reader View
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
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 text-sm">
              {activeTab === "preview" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 whitespace-pre-wrap font-sans">
                  {body || "No content body found."}
                </div>
              ) : (
                <pre className="max-h-[500px] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 font-mono text-xs text-[var(--color-foreground)] whitespace-pre-wrap">
                  {body}
                </pre>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-3.5">
              <span className="text-xs text-[var(--color-muted)]">
                Copy or download this article to paste into your website CMS.
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
