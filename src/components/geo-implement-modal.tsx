"use client";

import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Code2,
  Eye,
  Loader2,
  ArrowRight,
  Bot,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "./badges";

export type GeoOpportunityItem = {
  id: string;
  title: string;
  gapType: string;
  description: string;
  recommendation: string;
  priority: number;
  status: string;
  prompt?: { text: string } | null;
};

interface GeoImplementModalProps {
  opportunity: GeoOpportunityItem | null;
  websiteId: string;
  isOpen: boolean;
  onClose: () => void;
  onImplemented?: (oppId: string) => void;
}

export function GeoImplementModal({
  opportunity,
  websiteId,
  isOpen,
  onClose,
  onImplemented,
}: GeoImplementModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<"code" | "preview">("code");
  const [fixData, setFixData] = useState<{
    fixType: string;
    title: string;
    codeSnippet: string;
    htmlPreview: string;
    explanation: string;
    actionSummary: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !opportunity) return;
    setLoading(true);
    setFixData(null);

    fetch(`/api/geo/opportunities/${opportunity.id}/implement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId, action: "generate_preview" }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.data?.fix) {
          setFixData(json.data.fix);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, opportunity, websiteId]);

  if (!isOpen || !opportunity) return null;

  async function handleCopy() {
    if (!fixData?.codeSnippet) return;
    await navigator.clipboard.writeText(fixData.codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleMarkDone() {
    if (!opportunity) return;
    setSaving(true);
    try {
      await fetch(`/api/geo/opportunities/${opportunity.id}/implement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, action: "mark_done" }),
      });
      onImplemented?.(opportunity.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Bot size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                  GEO Agent Implementation
                </h3>
                <span className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)] uppercase">
                  {opportunity.gapType}
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] truncate max-w-md">
                {opportunity.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Query context if present */}
          {opportunity.prompt?.text && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs flex items-center justify-between gap-2">
              <span className="text-[var(--color-muted)]">Target AI Prompt:</span>
              <span className="font-semibold text-[var(--color-foreground)]">
                &ldquo;{opportunity.prompt.text}&rdquo;
              </span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)] mb-3" />
              <p className="text-sm font-semibold">Generating GEO Production Optimization...</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Synthesizing schema, entity facts, and AI extraction benchmarks
              </p>
            </div>
          ) : fixData ? (
            <div className="space-y-4">
              {/* Explanation & Action Instructions */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs space-y-1">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  Why this helps AI Search Rankings:
                </p>
                <p className="text-[var(--color-foreground)]">{fixData.explanation}</p>
                <p className="text-[11px] text-[var(--color-muted)] pt-1 border-t border-emerald-500/10">
                  <strong>Action:</strong> {fixData.actionSummary}
                </p>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView("code")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      activeView === "code"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    <Code2 size={13} />
                    Code / Snippet
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      activeView === "preview"
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    <Eye size={13} />
                    Live Visual Preview
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-[var(--color-success)]" />
                      <span className="text-[var(--color-success)]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>

              {/* Snippet / Preview Display */}
              {activeView === "code" ? (
                <div className="relative">
                  <pre className="max-h-72 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-gray-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap">
                    {fixData.codeSnippet}
                  </pre>
                </div>
              ) : (
                <div
                  className="max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-muted)]"
                  dangerouslySetInnerHTML={{ __html: fixData.htmlPreview }}
                />
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[var(--color-muted)]">
              No optimization payload could be generated.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-3.5 bg-[var(--color-surface-muted)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!fixData}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            >
              <Copy size={13} />
              Copy
            </button>

            <button
              type="button"
              onClick={handleMarkDone}
              disabled={saving || !fixData}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              <span>{saving ? "Saving…" : "Save & Mark as Implemented"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
