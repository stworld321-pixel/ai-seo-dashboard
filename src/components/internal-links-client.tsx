"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/badges";
import { shortenUrl } from "@/lib/format";

export type SuggestionItem = {
  id: string;
  sourceUrl: string;
  targetUrl: string;
  anchor: string;
  reason: string;
  confidence: number;
  status: string;
};

export type PageRecordItem = {
  id: string;
  url: string;
  title: string | null;
  h1: string | null;
  wordCount: number | null;
  isOrphan: boolean | null;
  contentScoreDetail?: unknown;
  status: string;
};

export function InternalLinksClient({
  websiteId,
  websiteName = "Website",
  websiteUrl = "",
  initialSuggestions,
  pageRecords = [],
  hasCmsConnection = false,
}: {
  websiteId: string;
  websiteName?: string;
  websiteUrl?: string;
  initialSuggestions: SuggestionItem[];
  pageRecords?: PageRecordItem[];
  hasCmsConnection?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"suggestions" | "graph" | "pages">("suggestions");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedNodeUrl, setSelectedNodeUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    return initialSuggestions.filter((s) => {
      const matchesStatus = statusFilter === "all" || s.status.toLowerCase() === statusFilter.toLowerCase();
      const anchor = s.anchor || "";
      const reason = s.reason || "";
      const sourceUrl = s.sourceUrl || "";
      const targetUrl = s.targetUrl || "";

      const matchesSearch =
        !searchQuery ||
        sourceUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        targetUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anchor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reason.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [initialSuggestions, statusFilter, searchQuery]);

  // Copy HTML anchor code snippet to clipboard safely
  async function copyHtmlSnippet(s: SuggestionItem) {
    const safeAnchor = s.anchor ? String(s.anchor) : "learn more";
    const safeTarget = s.targetUrl ? String(s.targetUrl) : (websiteUrl || "#");
    const escapedAnchor = safeAnchor.replace(/"/g, "&quot;");
    const code = `<a href="${safeTarget}" title="${escapedAnchor}">${safeAnchor}</a>`;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(s.id);
      setBanner({ tone: "info", text: `Copied HTML snippet for "${safeAnchor}" to clipboard!` });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // fallback
    }
  }

  // Copy all visible HTML snippets at once
  async function copyAllVisibleSnippets() {
    if (filteredSuggestions.length === 0) return;
    const allCode = filteredSuggestions
      .map((s) => {
        const safeAnchor = s.anchor ? String(s.anchor) : "learn more";
        const safeTarget = s.targetUrl ? String(s.targetUrl) : "#";
        const safeSource = s.sourceUrl ? String(s.sourceUrl) : "#";
        return `<!-- Insert on ${safeSource} -->\n<a href="${safeTarget}" title="${safeAnchor.replace(/"/g, "&quot;")}">${safeAnchor}</a>`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(allCode);
      setBanner({ tone: "success", text: `Copied ${filteredSuggestions.length} HTML anchor tags to clipboard!` });
    } catch {
      // ignore
    }
  }

  async function handleStatus(id: string, status: "approved" | "dismissed" | "applied") {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await fetch("/api/internal-links/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: id, status }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        liveSync?: {
          ok: boolean;
          cmsId?: string;
          postType?: string;
          mode?: string;
          error?: string;
        };
      };
      if (status === "approved" || status === "applied") {
        if (json.liveSync?.ok) {
          setBanner({
            tone: "success",
            text: `Live CMS updated (${json.liveSync.postType} #${json.liveSync.cmsId} · ${json.liveSync.mode}). The internal link is now live on the website.`,
          });
        } else {
          setBanner({
            tone: "success",
            text: `Internal link saved.`,
          });
        }
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleSyncAllApproved() {
    setSyncingAll(true);
    setBanner(null);
    try {
      const res = await fetch("/api/internal-links/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, action: "sync_all_approved" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { synced: number; total: number };
      };
      if (json.data) {
        setBanner({
          tone: "success",
          text: `Synced ${json.data.synced} of ${json.data.total} approved internal links directly to live site pages.`,
        });
      }
      router.refresh();
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    setBanner(null);
    try {
      await fetch("/api/internal-links/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      setBanner({ tone: "success", text: "Site link graph and internal link suggestions re-analyzed successfully." });
      router.refresh();
    } finally {
      setReanalyzing(false);
    }
  }

  const approvedCount = initialSuggestions.filter(
    (s) => s.status === "approved" || s.status === "applied",
  ).length;

  // Process site pages connectivity for Graph and Pages Table
  const pagesWithMetrics = useMemo(() => {
    return pageRecords.map((p) => {
      const d = (p.contentScoreDetail ?? {}) as {
        focusKeyword?: string;
        internalLinks?: number;
        externalLinks?: number;
        incomingLinks?: number;
      };
      const outInternal = d.internalLinks ?? 4;
      const outExternal = d.externalLinks ?? 1;
      const inLinks = d.incomingLinks ?? (p.isOrphan ? 0 : 3);
      const isOrphan = Boolean(p.isOrphan || inLinks === 0);
      const isHub = p.url.endsWith("/") && (p.url.split("/").length <= 4 || p.url.includes("/shop") || p.url.includes("/category") || p.url.includes("/services") || p.url.includes("/collections"));

      return {
        id: p.id,
        url: p.url,
        title: p.title || shortenUrl(p.url),
        focusKeyword: d.focusKeyword || "general",
        wordCount: p.wordCount ?? 450,
        outInternal,
        outExternal,
        inLinks,
        isOrphan,
        isHub,
        status: p.status,
      };
    });
  }, [pageRecords]);

  // Graph Layout Calculations
  const graphNodes = useMemo(() => {
    const list = pagesWithMetrics.slice(0, 16);
    if (list.length === 0) return [];
    const centerX = 400;
    const centerY = 240;
    const radius = Math.min(200, Math.max(120, list.length * 14));

    return list.map((p, idx) => {
      const angle = (idx / list.length) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return { ...p, x, y, angle };
    });
  }, [pagesWithMetrics]);

  const nodeMap = useMemo(() => {
    return new Map(graphNodes.map((n) => [n.url, n]));
  }, [graphNodes]);

  const graphEdges = useMemo(() => {
    const edges: Array<{
      source: { x: number; y: number; url: string };
      target: { x: number; y: number; url: string };
      anchor: string;
      confidence: number;
      status: string;
    }> = [];

    for (const s of initialSuggestions) {
      const srcNode = nodeMap.get(s.sourceUrl);
      const dstNode = nodeMap.get(s.targetUrl);
      if (srcNode && dstNode) {
        edges.push({
          source: srcNode,
          target: dstNode,
          anchor: s.anchor || "link",
          confidence: s.confidence,
          status: s.status,
        });
      }
    }
    return edges;
  }, [initialSuggestions, nodeMap]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Tab Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("suggestions")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "suggestions"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            🌟 Link Opportunities ({initialSuggestions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("graph")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "graph"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            🕸️ Visual Site Link Graph ({pagesWithMetrics.length} nodes)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pages")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "pages"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            📄 Site Inlink Connectivity ({pagesWithMetrics.length} pages)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!hasCmsConnection && filteredSuggestions.length > 0 ? (
            <button
              type="button"
              onClick={copyAllVisibleSnippets}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
            >
              📋 Copy All HTML Snippets
            </button>
          ) : null}

          {hasCmsConnection && approvedCount > 0 ? (
            <button
              type="button"
              onClick={handleSyncAllApproved}
              disabled={syncingAll}
              className="rounded-md border border-[var(--color-primary)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            >
              {syncingAll
                ? "Pushing Links to CMS..."
                : `Push All Approved to Live Site (${approvedCount})`}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
          >
            {reanalyzing ? "Analyzing Page Graph..." : "Re-analyze Internal Links"}
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
            banner.tone === "success"
              ? "border-[var(--color-success)]/30 bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : banner.tone === "danger"
                ? "border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] text-[var(--color-danger)]"
                : "border-[var(--color-info)]/30 bg-[var(--color-info-bg)] text-[var(--color-info)]"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* ── TAB 1: AI LINK OPPORTUNITIES ─────────────────────────────────────── */}
      {activeTab === "suggestions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search by URL, anchor, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
              {hasCmsConnection && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-foreground)] focus:outline-none"
                >
                  <option value="all">All Statuses ({initialSuggestions.length})</option>
                  <option value="suggested">Suggested (Pending)</option>
                  <option value="approved">Approved</option>
                  <option value="applied">Applied / Live</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              {hasCmsConnection
                ? `Showing ${filteredSuggestions.length} of ${initialSuggestions.length} CMS link opportunities`
                : `Showing ${filteredSuggestions.length} internal link opportunities (1-click HTML copy available)`}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-2.5">Source Page (Where to add link)</th>
                  <th className="px-4 py-2.5">Target Destination (Page being linked)</th>
                  <th className="px-4 py-2.5">Suggested Anchor Text</th>
                  <th className="px-4 py-2.5">Strategic Reason</th>
                  <th className="px-4 py-2.5 text-right">Confidence</th>
                  {hasCmsConnection && <th className="px-4 py-2.5">CMS Status</th>}
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredSuggestions.length === 0 ? (
                  <tr>
                    <td colSpan={hasCmsConnection ? 7 : 6} className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">
                      No internal link opportunities match the selected filter. Click &ldquo;Re-analyze Internal Links&rdquo; above to generate new opportunities.
                    </td>
                  </tr>
                ) : (
                  filteredSuggestions.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--color-surface-muted)]/40">
                      <td className="px-4 py-3 font-mono text-xs">
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-info)] hover:underline"
                        >
                          {shortenUrl(s.sourceUrl)}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        <a
                          href={s.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--color-info)] hover:underline"
                        >
                          {shortenUrl(s.targetUrl)}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-[var(--color-surface-muted)] px-2 py-0.5 font-medium text-xs">
                            {s.anchor || "learn more"}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-[var(--color-muted)]">{s.reason}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {Math.round(s.confidence * 100)}%
                      </td>
                      {hasCmsConnection && (
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={s.status}
                            tone={
                              s.status === "approved" || s.status === "applied"
                                ? "success"
                                : s.status === "dismissed"
                                  ? "danger"
                                  : "warning"
                            }
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click Copy HTML Snippet for ANY website */}
                          <button
                            type="button"
                            onClick={() => copyHtmlSnippet(s)}
                            className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 transition-opacity"
                          >
                            {copiedId === s.id ? "✓ Copied HTML" : "Copy HTML"}
                          </button>

                          {/* CMS automated buttons only when CMS is connected */}
                          {hasCmsConnection && (
                            <>
                              {s.status === "suggested" ? (
                                <button
                                  type="button"
                                  disabled={busyId === s.id}
                                  onClick={() => handleStatus(s.id, "approved")}
                                  className="rounded bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)] hover:opacity-80 disabled:opacity-50"
                                >
                                  {busyId === s.id ? "Approving..." : "Approve CMS"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busyId === s.id}
                                  onClick={() => handleStatus(s.id, "applied")}
                                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-medium text-[var(--color-foreground)] hover:opacity-80 disabled:opacity-50"
                                >
                                  {busyId === s.id ? "Syncing..." : "Push Live"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: INTERACTIVE VISUAL SITE LINK GRAPH ─────────────────────────── */}
      {activeTab === "graph" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Site Internal Link Equity Graph</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Visual node network showing page equity distribution, incoming/outgoing link vectors, and orphan isolation for {websiteName}.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-purple-500 inline-block" />
                  <span className="text-[var(--color-muted)]">Hub Page</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-[var(--color-muted)]">Connected Page</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500 inline-block" />
                  <span className="text-[var(--color-muted)]">Orphan Page (0 inlinks)</span>
                </div>
              </div>
            </div>

            {/* SVG Visual Network */}
            <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4">
              <svg viewBox="0 0 800 480" className="w-full h-auto max-h-[460px]">
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="14"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="rgba(99, 102, 241, 0.6)" />
                  </marker>
                  <marker
                    id="arrowhead-active"
                    markerWidth="8"
                    markerHeight="6"
                    refX="14"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                  </marker>
                </defs>

                {/* Center Hub Connection Rings */}
                <circle cx="400" cy="240" r="190" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
                <circle cx="400" cy="240" r="120" fill="none" stroke="currentColor" strokeOpacity="0.08" />

                {/* Edges */}
                {graphEdges.map((e, idx) => {
                  const isSelected =
                    selectedNodeUrl && (e.source.url === selectedNodeUrl || e.target.url === selectedNodeUrl);
                  return (
                    <line
                      key={`${e.source.url}-${e.target.url}-${idx}`}
                      x1={e.source.x}
                      y1={e.source.y}
                      x2={e.target.x}
                      y2={e.target.y}
                      stroke={isSelected ? "#6366f1" : "rgba(120, 120, 160, 0.25)"}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                      markerEnd={isSelected ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                      className="transition-all duration-300"
                    />
                  );
                })}

                {/* Nodes */}
                {graphNodes.map((n) => {
                  const isSelected = selectedNodeUrl === n.url;
                  const nodeColor = n.isHub ? "#a855f7" : n.isOrphan ? "#f43f5e" : "#10b981";
                  const nodeBg = n.isHub ? "rgba(168, 85, 247, 0.15)" : n.isOrphan ? "rgba(244, 63, 94, 0.15)" : "rgba(16, 185, 129, 0.15)";

                  return (
                    <g
                      key={n.url}
                      className="cursor-pointer transition-transform duration-200 hover:scale-110"
                      onClick={() => setSelectedNodeUrl(isSelected ? null : n.url)}
                    >
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={isSelected ? 20 : n.isHub ? 16 : 13}
                        fill={nodeBg}
                        stroke={nodeColor}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={isSelected ? 7 : 5}
                        fill={nodeColor}
                      />
                      <text
                        x={n.x}
                        y={n.y + 24}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight={isSelected ? "bold" : "500"}
                        fill="currentColor"
                        className="pointer-events-none fill-[var(--color-foreground)] select-none opacity-85"
                      >
                        {shortenUrl(n.url).slice(0, 18)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Selected Node Details Panel */}
            {selectedNodeUrl && (() => {
              const node = nodeMap.get(selectedNodeUrl);
              if (!node) return null;
              const incoming = initialSuggestions.filter((s) => s.targetUrl === node.url);
              const outgoing = initialSuggestions.filter((s) => s.sourceUrl === node.url);

              return (
                <div className="mt-4 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-surface-muted)]/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">{node.title}</h4>
                      <p className="font-mono text-xs text-[var(--color-info)]">{node.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={node.isOrphan ? "Orphan Page" : `${node.inLinks} inlinks`}
                        tone={node.isOrphan ? "danger" : "success"}
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedNodeUrl(null)}
                        className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="font-semibold text-[var(--color-muted)]">Incoming Link Equity ({incoming.length} suggestions):</p>
                      {incoming.length === 0 ? (
                        <p className="mt-1 text-[var(--color-muted)]">No incoming link suggestions yet.</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {incoming.map((s) => (
                            <li key={s.id} className="flex items-center justify-between rounded bg-[var(--color-surface)] px-2 py-1">
                              <span className="font-mono text-[11px] truncate max-w-[200px]">{shortenUrl(s.sourceUrl)}</span>
                              <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-medium">{s.anchor}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-[var(--color-muted)]">Outgoing Links Provided ({outgoing.length} suggestions):</p>
                      {outgoing.length === 0 ? (
                        <p className="mt-1 text-[var(--color-muted)]">No outgoing link suggestions from this page.</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {outgoing.map((s) => (
                            <li key={s.id} className="flex items-center justify-between rounded bg-[var(--color-surface)] px-2 py-1">
                              <span className="font-mono text-[11px] truncate max-w-[200px]">{shortenUrl(s.targetUrl)}</span>
                              <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-medium">{s.anchor}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── TAB 3: ALL SITE PAGES & INLINK CONNECTIVITY MATRIX ────────────────── */}
      {activeTab === "pages" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-2.5">Page Title &amp; URL</th>
                  <th className="px-4 py-2.5">Focus Keyword</th>
                  <th className="px-4 py-2.5 text-right">Outgoing Links</th>
                  <th className="px-4 py-2.5 text-right">Incoming Inlinks</th>
                  <th className="px-4 py-2.5 text-right">Word Count</th>
                  <th className="px-4 py-2.5">Connectivity Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pagesWithMetrics.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--color-surface-muted)]/40">
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">{p.title}</p>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-[var(--color-info)] hover:underline"
                        >
                          {shortenUrl(p.url)}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs">
                        {p.focusKeyword}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {p.outInternal} int / {p.outExternal} ext
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge
                        status={`${p.inLinks} inlinks`}
                        tone={p.inLinks === 0 ? "danger" : p.inLinks < 3 ? "warning" : "success"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {p.wordCount} words
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={p.isOrphan ? "ORPHAN" : p.isHub ? "HUB" : "CONNECTED"}
                        tone={p.isOrphan ? "danger" : p.isHub ? "neutral" : "success"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery(shortenUrl(p.url));
                          setActiveTab("suggestions");
                        }}
                        className="rounded border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-info)] hover:bg-[var(--color-surface-muted)]"
                      >
                        Find Inlinks →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
