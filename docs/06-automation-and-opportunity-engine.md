# Automation Architecture & the Opportunity Engine

## Daily workflow (spec §19, §20)

```
08:00 website-local
  │
  ├─ 1. SYNC        GSC (date, query, page, country, device) + GA4, incremental from cursor
  ├─ 2. RECONCILE   upsert into time-series tables; refresh Keyword/PageRecord rollups
  ├─ 3. ANALYZE     SEO Analyst: period-over-period deltas, anomaly flags
  ├─ 4. DETECT      Opportunity Engine (pure code, no LLM) → Opportunity rows
  ├─ 5. STRATEGIZE  Keyword + Content Strategist: clusters, gaps, briefs
  ├─ 6. PLAN        Orchestrator builds today's ranked action list → /api/seo/today
  ├─ 7. PRODUCE     (level ≥3) drafts for the top N actions
  ├─ 8. QA          SEO QA Agent gates everything
  ├─ 9. APPROVE     queue for human (level ≤3) or auto-approve (level 4/5, non-destructive only)
  ├─10. PUBLISH     CMS adapter write, then sitemap ping if appropriate
  ├─11. EXPERIMENT  record baseline into ContentExperiment
  └─12. NOTIFY      digest notification + anomalies
+14d / +28d
  └─ MEASURE        Performance Agent → outcome + LearningSignal → feeds step 4 scoring
```

Each step is a queued job; a failure at step N doesn't lose steps 1..N-1. Runs are recorded in
`AutomationRun` with per-step status so the Activity page can show exactly where it stopped.

## Automation levels

| Level | Name | Allowed without human |
|---|---|---|
| 1 | Analysis only | sync + analyze + detect |
| 2 | **Recommendations (default)** | + briefs, suggested titles/metas/links (nothing written) |
| 3 | Content drafts | + generate drafts, store as `AWAITING_APPROVAL` |
| 4 | Auto-publish approved | + publish items a human approved; auto-apply low-risk on-page fixes |
| 5 | Fully automated | + auto-approve non-destructive changes within configured limits |

Hard-gated at **every** level (spec §21): delete page, redirect, URL change, canonical change,
robots.txt change, sitewide schema change, large-scale content replacement. These always create
an `Approval` row, even at level 5.

## Opportunity Engine — exact algorithms

All inputs come from our own Postgres. No invented metrics. Every output carries `evidence`.

Shared definitions over a window W (default 28d) and previous window W' of equal length:
`imp`, `clicks`, `ctr = clicks/imp`, `pos` = impression-weighted average position.

**Site CTR curve.** Rather than a generic industry curve, we fit the site's own:
`siteCtr(p)` = median CTR of all (query,date) rows whose position rounds to `p`, smoothed over
±1 position, with a fallback to a standard curve when a bucket has < 20 impressions total. This
matters: litenatures.in has 0 clicks sitewide, so its fitted curve is degenerate and the engine
correctly falls back — and flags "no click data yet" rather than hallucinating a CTR gap.

### A. QUICK_WIN — position 4–10, high impressions, CTR below expectation
```
candidates: pos ∈ [3.5, 10.5] AND imp ≥ max(20, p60(imp))
gap        = max(0, siteCtr(pos) − ctr)
potential  = gap × imp                        // "estimated additional clicks", labelled estimate
score      = potential × log10(imp+10) × trendFactor × learnedWeight
actions    = rewrite title, rewrite meta, add FAQ, strengthen internal links
```

### B. PAGE_TWO — position 11–20
```
candidates: pos ∈ [10.5, 20.5] AND imp ≥ 10
headroom   = siteCtr(8) × imp                 // clicks if it reached position ~8
score      = headroom × relevance × intentFit × trendFactor × learnedWeight
             relevance = cosine(keyword, best page content)
actions    = expand article, comparison table, FAQ, supporting internal links, off-page
```

### C. CTR_GAP — any position, imp high, ctr ≪ expected
```
candidates: imp ≥ p75(imp) AND ctr < 0.5 × siteCtr(pos)
output     = 3 alternative titles + 3 metas (On-Page Agent), user picks one
```

### D. DECLINING_KEYWORD / DECLINING_PAGE
```
compare W vs W' at 7/28/90-day granularities
flag when: Δclicks ≤ −25% AND absolute drop ≥ 5 clicks
       or: Δpos ≥ +3 positions with imp ≥ 50
       or: Δimp ≤ −30% with imp(W') ≥ 100
severity by absolute click loss; attribution lists the pages causing ≥70% of the drop
```

### E. CONTENT_DECAY
```
page-level: 3 consecutive 28d windows of declining clicks
        AND lastModifiedAt > 180 days ago
        AND position worsened ≥ 2
→ recommend refresh with a diff of what competitors now cover (when crawl data available)
```

### F. CANNIBALIZATION
```
for each query with ≥ 2 pages receiving impressions in W:
  if no single page holds ≥ 70% of impressions AND both pages rank < 30
  → flag; recommend consolidate/canonical/differentiate (never auto-delete)
```

### G. CONTENT_GAP
```
cluster the site's queries; for each cluster compute coverage = (# site pages targeting it)
gaps = clusters with impressions > threshold and no dedicated page
     + query variants present in GSC with no page ranking < 30
→ Content Strategist turns these into briefs (pillar / supporting / FAQ / commercial)
```

### H. INTERNAL_LINK
```
for each (source, target) page pair:
  score = topicalSimilarity(source, target)
        × targetOpportunityScore
        × (1 / (1 + existingInboundLinks(target)))
  require: anchor text occurs naturally in source body, not already linked
output: source, target, anchor, reason, confidence — approve/reject/auto-apply
```

### Priority mapping
Scores are normalized per website (percentile rank), then bucketed:
P1 ≥ p90, P2 ≥ p70, P3 ≥ p40, P4 ≥ p15, P5 otherwise. The "What should I do today?" panel takes
the top action from each distinct type so the list is diverse, not five variations of one fix.

## SEO Health Score (spec §8 — "no meaningless score")

Score = weighted sum of 10 category sub-scores, each computed from **counted, linkable issues**:

| Category | Weight | Sub-score from |
|---|---|---|
| Technical SEO | 15 | indexation errors, 404s, redirect chains, canonical conflicts |
| Content | 15 | thin pages, decaying pages, missing briefs for gaps |
| Keywords | 12 | share of impressions in pos ≤10 vs 11–20 vs >20 |
| Internal Linking | 10 | orphan pages, pages with <2 inbound links |
| CTR | 12 | sum of CTR gap potential ÷ total impressions |
| Indexation | 10 | indexed / submitted ratio |
| Schema | 8 | pages missing applicable schema type |
| AEO/GEO | 8 | pages lacking answer blocks / FAQ / entity coverage |
| Backlinks | 5 | only when a backlink source is connected; otherwise excluded and weights renormalized |
| Local SEO | 5 | only for websites flagged local; otherwise excluded |

Every point deducted links to the exact issue rows that caused it. Clicking the score opens that
list. Categories without data are **excluded and weights renormalized** — never silently scored
as 100 or 0.
