"use client";

import { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { XOpportunityItem } from "@/server/services/x-agent";

interface XDraftModalProps {
  opportunity: XOpportunityItem | null;
  websiteId: string;
  isOpen: boolean;
  onClose: () => void;
  onApproved: (updated: XOpportunityItem) => void;
}

export function XDraftModal({
  opportunity,
  websiteId,
  isOpen,
  onClose,
  onApproved,
}: XDraftModalProps) {
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [postedUrlInput, setPostedUrlInput] = useState("");

  useEffect(() => {
    if (opportunity) {
      setDraftText(opportunity.draftContent || "");
      setPostedUrlInput(opportunity.postUrl || "");
    }
  }, [opportunity]);

  if (!isOpen || !opportunity) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/x-agent/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity?.id, websiteId }),
      });
      const json = await res.json();
      if (json.data?.opportunity?.draftContent) {
        setDraftText(json.data.opportunity.draftContent);
      }
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleMarkPosted(status: "posted" | "approved") {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/x-agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity?.id,
          websiteId,
          draftContent: draftText,
          status,
        }),
      });
      const json = await res.json();
      if (json.data?.opportunity) {
        onApproved(json.data.opportunity);
        onClose();
      }
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false);
    }
  }

  const charCount = draftText.length;
  const isOverLimit = charCount > 280;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm font-bold text-sky-600">
              @{opportunity.creatorHandle}
            </span>
            <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-600">
              X Outreach &amp; Reply Review
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Discussion Context */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
                Topic &amp; Authority Relevance
              </span>
              {opportunity.postUrl && (
                <a
                  href={opportunity.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline font-medium"
                >
                  <span>View on X</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <p className="text-sm font-bold text-[var(--color-foreground)]">{opportunity.topic}</p>
            {opportunity.audienceNotes && (
              <p className="text-xs text-[var(--color-muted)]">{opportunity.audienceNotes}</p>
            )}
            {opportunity.whyRelevant && (
              <p className="text-xs text-[var(--color-foreground)]">
                <strong>Why Relevant:</strong> {opportunity.whyRelevant}
              </p>
            )}
          </div>

          {/* Draft Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Expert Reply Draft (Non-Spam / Factual)
              </label>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
              >
                {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>Regenerate with AI</span>
              </button>
            </div>

            <textarea
              rows={5}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-xs text-[var(--color-foreground)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-mono resize-y"
              placeholder="Enter your X response draft..."
            />

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                <ShieldCheck size={14} className="text-green-600" />
                <span>Zero promotional link-dropping. Pure domain authority &amp; education.</span>
              </div>
              <span className={`font-mono text-xs ${isOverLimit ? "text-[var(--color-danger)] font-bold" : "text-[var(--color-muted)]"}`}>
                {charCount} / 280 characters
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-surface-muted)] transition-colors"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span>{copied ? "Copied to Clipboard!" : "Copy Draft"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleMarkPosted("approved")}
              disabled={isSubmitting}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50"
            >
              Save as Approved
            </button>

            <button
              type="button"
              onClick={() => handleMarkPosted("posted")}
              disabled={isSubmitting || isOverLimit}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Mark as Posted &amp; Active</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
