"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Bot,
  Globe,
} from "lucide-react";

interface PromptRunResult {
  engine: string;
  result?: {
    brandMentioned: boolean;
    brandPosition: number | null;
    citationFound: boolean;
    citationUrl: string | null;
    citationDomain: string | null;
    competitorsMentioned: string[];
    sourceDomains: string[];
    sentiment: string;
  };
  error?: string;
  response?: string;
}

export function PromptRunButton({
  promptId,
  websiteId,
  promptText,
}: {
  promptId: string;
  websiteId: string;
  promptText?: string;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<PromptRunResult[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function handleRun() {
    setRunning(true);
    setErrorMessage(null);
    setResults(null);
    try {
      const res = await fetch("/api/ai/prompts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, websiteId }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to execute AI prompt evaluation");
      }

      setResults(json.data?.results || []);
      setModalOpen(true);
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  function handleCopy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          title="Test this prompt live across ChatGPT, Claude, Perplexity & Gemini"
          className="flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 transition-colors shadow-2xs"
        >
          {running ? (
            <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />
          ) : (
            <Play size={12} className="text-[var(--color-primary)] fill-current" />
          )}
          <span>{running ? "Testing AI…" : "Test AI"}</span>
        </button>

        {errorMessage && (
          <span className="text-[10px] text-[var(--color-danger)] font-medium" title={errorMessage}>
            Failed ⚠
          </span>
        )}
      </div>

      {/* Results Modal */}
      {modalOpen && results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in text-left text-start font-normal">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden text-left text-start font-normal">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-[var(--color-foreground)]">
                    Live AI Engine Search Results
                  </h3>
                  <p className="text-xs text-[var(--color-muted)] truncate max-w-lg">
                    {promptText || "Prompt evaluation across ChatGPT, Claude, Perplexity & Gemini"}
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

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((r, idx) => {
                  const engineTitle =
                    r.engine === "chatgpt"
                      ? "ChatGPT (GPT-4o)"
                      : r.engine === "claude"
                      ? "Claude (Anthropic)"
                      : r.engine === "perplexity"
                      ? "Perplexity (Sonar)"
                      : "Google AI Overview (Gemini)";

                  const isCited = r.result?.citationFound;
                  const isMentioned = r.result?.brandMentioned;

                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[var(--color-foreground)] flex items-center gap-1.5">
                            <Bot size={13} className="text-[var(--color-primary)]" />
                            {engineTitle}
                          </span>

                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              isCited
                                ? "bg-green-500/10 text-[var(--color-success)]"
                                : isMentioned
                                ? "bg-blue-500/10 text-[var(--color-info)]"
                                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                            }`}
                          >
                            {isCited ? "Cited ✓" : isMentioned ? "Mentioned" : "Not Found"}
                          </span>
                        </div>

                        {r.result && (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-[11px] text-[var(--color-muted)]">
                              <span>Brand Position:</span>
                              <strong className="text-[var(--color-foreground)]">
                                {r.result.brandPosition ? `#${r.result.brandPosition}` : "—"}
                              </strong>
                            </div>

                            <div className="flex justify-between text-[11px] text-[var(--color-muted)]">
                              <span>Sentiment:</span>
                              <span className="capitalize text-[var(--color-foreground)] font-medium">
                                {r.result.sentiment.replace("_", " ")}
                              </span>
                            </div>

                            {r.result.citationUrl && (
                              <div className="pt-1 border-t border-[var(--color-border)]">
                                <span className="text-[10px] text-[var(--color-muted)] block">Cited Link:</span>
                                <a
                                  href={r.result.citationUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-[11px] text-[var(--color-info)] hover:underline truncate block"
                                >
                                  {r.result.citationUrl}
                                </a>
                              </div>
                            )}

                            {r.result.competitorsMentioned?.length > 0 && (
                              <div className="pt-1 text-[10px] text-[var(--color-muted)]">
                                Competitors: {r.result.competitorsMentioned.join(", ")}
                              </div>
                            )}
                          </div>
                        )}

                        {r.error && (
                          <p className="text-xs text-[var(--color-danger)] font-medium">
                            {r.error}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px]">
                        <span className="text-[var(--color-muted)] text-[10px]">
                          Audited just now
                        </span>
                        {r.result && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                `Engine: ${engineTitle}\nStatus: ${isCited ? "Cited" : isMentioned ? "Mentioned" : "Not Found"}\nPosition: ${r.result?.brandPosition || "N/A"}`,
                                idx,
                              )
                            }
                            className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                          >
                            {copiedIndex === idx ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-3">
              <span className="text-xs text-[var(--color-muted)]">
                Evaluations recorded in historical tracking and weekly audit snapshots.
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
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
