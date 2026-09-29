"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Check, Loader2 } from "lucide-react";

type DiscoveredPrompt = {
  text: string;
  category: string;
  intent: string;
  priority: number;
  source: string;
  rationale: string;
};

export function PromptAddForm({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [intent, setIntent] = useState("informational");
  const [priority, setPriority] = useState("2");
  const [country, setCountry] = useState("IND");
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredPrompt[]>([]);
  const [addedPrompts, setAddedPrompts] = useState<Set<string>>(new Set());

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          text: text.trim(),
          intent,
          priority: parseInt(priority, 10),
          country,
        }),
      });
      setText("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDiscover() {
    setDiscovering(true);
    try {
      const res = await fetch("/api/ai/prompts/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, autoSave: false }),
      });
      const data = await res.json() as { data?: { discovered: DiscoveredPrompt[] } };
      if (data.data?.discovered) {
        setDiscovered(data.data.discovered);
      }
    } finally {
      setDiscovering(false);
    }
  }

  async function handleAddDiscovered(p: DiscoveredPrompt) {
    try {
      await fetch("/api/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          text: p.text,
          intent: p.intent,
          priority: p.priority,
          source: p.source,
        }),
      });
      setAddedPrompts((prev) => new Set(prev).add(p.text));
      router.refresh();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddManual} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold">Track New Search Prompt</h3>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          Add natural language search queries and buyer questions to monitor across ChatGPT, Claude, Perplexity & Gemini.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-muted)]">Prompt Text</label>
            <input
              type="text"
              required
              placeholder="e.g. Best TMT bar manufacturers in Tamil Nadu"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">Intent</label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="informational">Informational</option>
              <option value="commercial">Commercial</option>
              <option value="transactional">Transactional</option>
              <option value="comparison">Comparison</option>
              <option value="local">Local</option>
              <option value="recommendation">Recommendation</option>
              <option value="how-to">How-to</option>
              <option value="pricing">Pricing</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="3">High Priority</option>
              <option value="2">Medium Priority</option>
              <option value="1">Low Priority</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discovering}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            {discovering ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {discovering ? "Analyzing GSC & Catalog…" : "AI Discover Prompts"}
          </button>

          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Prompt to Tracker
          </button>
        </div>
      </form>

      {discovered.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Discovered High-Intent Prompts ({discovered.length})</h3>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Synthesized by analyzing your GSC impressions, product entities, and AI search inquiry patterns.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDiscovered([])}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              Dismiss
            </button>
          </div>

          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {discovered.map((p, idx) => {
              const isAdded = addedPrompts.has(p.text);
              return (
                <div key={idx} className="flex items-start justify-between gap-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{p.text}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-medium uppercase text-[10px]">
                        {p.category}
                      </span>
                      <span>·</span>
                      <span>{p.rationale}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddDiscovered(p)}
                    disabled={isAdded}
                    className={`shrink-0 flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                      isAdded
                        ? "bg-[var(--color-success)] text-white"
                        : "border border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-border)]"
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check size={12} /> Added
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Add
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
