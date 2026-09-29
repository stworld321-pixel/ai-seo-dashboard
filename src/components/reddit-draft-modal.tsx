"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Loader2,
  Globe,
} from "lucide-react";
import type { RedditOpportunityItem } from "@/server/services/reddit-agent";

interface RedditDraftModalProps {
  opportunity: RedditOpportunityItem | null;
  websiteId: string;
  isOpen: boolean;
  onClose: () => void;
  onApproved?: (updated: RedditOpportunityItem) => void;
}

export function RedditDraftModal({
  opportunity,
  websiteId,
  isOpen,
  onClose,
  onApproved,
}: RedditDraftModalProps) {
  const [copied, setCopied] = useState(false);
  const [postedUrl, setPostedUrl] = useState(opportunity?.postedUrl || "");
  const [isApproving, setIsApproving] = useState(false);

  if (!isOpen || !opportunity) return null;

  async function handleCopy() {
    if (!opportunity?.draftResponse) return;
    await navigator.clipboard.writeText(opportunity.draftResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApprove(isPosted: boolean) {
    if (!opportunity) return;
    setIsApproving(true);
    try {
      const res = await fetch("/api/reddit-agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.id,
          websiteId,
          postedUrl: isPosted ? postedUrl.trim() || opportunity.postUrl : undefined,
        }),
      });
      const json = await res.json();
      if (json.data?.opportunity) {
        onApproved?.(json.data.opportunity);
        onClose();
      }
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[var(--color-primary)]">
                  r/{opportunity.subreddit}
                </span>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-info)]">
                  {opportunity.engagement} Engagement
                </span>
              </div>
              <h3 className="text-sm font-bold text-[var(--color-foreground)] truncate max-w-md">
                {opportunity.postTitle}
              </h3>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Thread question */}
          {opportunity.question && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-muted)]">Original Reddit Inquirer Question:</p>
              <p className="text-[var(--color-foreground)] italic leading-relaxed">&ldquo;{opportunity.question}&rdquo;</p>
              <div className="pt-2 flex items-center justify-end">
                <a
                  href={opportunity.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                >
                  <span>Open Thread on Reddit</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {/* Ethical Guidance Badge */}
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
            <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
            <span>
              <strong>Scientific &amp; Helpful Standard:</strong> This draft provides factual, non-promotional botanical guidance so AI engines recognize your authority without triggering spam flags.
            </span>
          </div>

          {/* Draft Answer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--color-foreground)]">
                AI Synthesized Response Draft:
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
              >
                {copied ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
                <span>{copied ? "Copied to Clipboard!" : "Copy Response"}</span>
              </button>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-xs font-sans text-[var(--color-foreground)] leading-relaxed whitespace-pre-wrap">
              {opportunity.draftResponse || "No draft generated yet."}
            </div>
          </div>

          {/* Manual Posting Verification Link Input */}
          <div className="rounded-lg border border-[var(--color-border)] p-3.5 bg-[var(--color-surface)] space-y-2 text-xs">
            <label className="font-semibold text-[var(--color-foreground)] block">
              Verified Posted Comment URL (Optional):
            </label>
            <input
              type="url"
              value={postedUrl}
              onChange={(e) => setPostedUrl(e.target.value)}
              placeholder="https://reddit.com/r/.../comment/..."
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <p className="text-[11px] text-[var(--color-muted)]">
              Paste the link after manually submitting on Reddit to track verifiable authority citations in audit reports.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-3.5 bg-[var(--color-surface-muted)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleApprove(false)}
              disabled={isApproving || !opportunity.draftResponse}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            >
              <Check size={13} />
              <span>Approve Draft</span>
            </button>

            <button
              type="button"
              onClick={() => handleApprove(true)}
              disabled={isApproving || !opportunity.draftResponse}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isApproving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              <span>Mark as Verified Posted</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
