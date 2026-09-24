# Dashboard Wireframe & Design System

## Design tokens (spec §1)

```
--bg            #FAFAF9   off-white canvas
--surface       #FFFFFF   cards
--border        #E7E5E4
--text          #1C1917   dark
--text-muted    #78716C
--primary       #8B1E2D   red/maroon accent
--primary-fg    #FFFFFF
--success       #15803D   green
--warning       #C2410C   orange
--danger        #B91C1C
--radius        10px
font: Inter (UI) / JetBrains Mono (numbers in tables)
```

Desktop-first, responsive down to 375px. Sidebar collapses to icon rail < 1280px, drawer < 768px.

## Shell

```
┌────────────┬───────────────────────────────────────────────────────────────┐
│            │  [Website ▾ litenatures.in]   [Range ▾ Last 28 days]  🔔  👤  │
│  SIDEBAR   ├───────────────────────────────────────────────────────────────┤
│            │                                                               │
│ Dashboard  │   page content                                                │
│ Websites   │                                                               │
│ PERFORMANCE│                                                               │
│  Search C. │                                                               │
│  Analytics │                                                               │
│ SEO INTEL  │                                                               │
│  Keywords  │                                                               │
│  Opportun. │                                                               │
│  Pages     │                                                               │
│  Technical │                                                               │
│ CONTENT    │                                                               │
│  Library   │                                                               │
│  Generator │                                                               │
│  Optimizer │                                                               │
│  Int.Links │                                                               │
│  Schema    │                                                               │
│ AI SEARCH  │                                                               │
│  AEO / GEO │                                                               │
│  Visibility│                                                               │
│ AUTOMATION │                                                               │
│  Daily Agt │                                                               │
│  Blogs     │                                                               │
│  Workflows │                                                               │
│  Activity  │                                                               │
│ Approvals  │  ← badge with pending count                                   │
│ Reports    │                                                               │
│ Settings   │                                                               │
└────────────┴───────────────────────────────────────────────────────────────┘
```

## Dashboard page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⬛ WHAT SHOULD I DO TODAY?                          Based on last 28 days   │
│ ───────────────────────────────────────────────────────────────────────────│
│ P1  Fix 2 page-1 listings getting zero clicks                              │
│     Why: "coconut milk soap" — 73 impressions at position 8.8, CTR 0%      │
│     Expected: +4 to +7 clicks/mo   URL: /product/coconutmilk-soap/         │
│     Evidence: [site CTR at pos 9 = n/a · 0 clicks in 28d · mobile 66%]    │
│                                              [ Generate titles ] [ Details ]│
│ P2  Rewrite titles for 5 pages with impressions and no clicks              │
│ P3  Expand "fairness soap" page — position 17.3, 32 impressions            │
│ P4  Add 11 internal links to product pages with <2 inbound links           │
│ P5  Create cluster content for "kumkumadi serum" (3 queries, 81 imp, p44+) │
└─────────────────────────────────────────────────────────────────────────────┘

┌── KPI ROW (MetricCard × 8) ───────────────────────────────────────────────┐
│ Google Clicks │ Impressions │ Avg Position │ CTR │ Organic Users │ ...     │
│      0        │    584      │    25.2      │ 0%  │     —         │         │
│   ▬ 0.0%      │  ▲ 18.4%    │  ▲ 2.1 pos   │  —  │  connect GA4  │         │
└───────────────────────────────────────────────────────────────────────────┘
   (each card: value, delta vs previous period, sparkline, click → drilldown)

┌── Organic Traffic Growth ──────────────┬── SEO Health 78/100 ─────────────┐
│  multi-line: clicks · impressions ·    │  radial + category bars          │
│  users · sessions  [7d 28d 90d 6m 1y]  │  "8 pages declining · 14 kw 11-20"│
│  hover: date, clicks, imp, CTR, pos    │  click → issue list              │
└────────────────────────────────────────┴───────────────────────────────────┘

┌── Top Opportunities ───────────────────┬── Agent Activity ────────────────┐
│ OpportunityCard list, type-filtered    │ AgentStatus + live log feed      │
└────────────────────────────────────────┴───────────────────────────────────┘

┌── Keywords table (top 10) ─────────────┬── Pages table (top 10) ──────────┐
└────────────────────────────────────────┴───────────────────────────────────┘
```

## Reusable components (spec §39)

| Component | Props / behavior |
|---|---|
| `MetricCard` | label, value, delta, deltaDirection, sparkline, emptyState ("connect GA4") |
| `ChartCard` | title, range switcher, Recharts child, CSV export |
| `DataTable` | server-side sort/filter/paginate, column visibility, saved views, CSV export |
| `StatusBadge` | maps PageStatus/ContentStatus/TaskState → color + icon |
| `OpportunityCard` | priority chip, keyword, URL, evidence popover, primary action button |
| `AgentStatus` | agent name, state dot, current task, tokens used, last run |
| `ApprovalModal` | side-by-side diff (current vs proposed), risk badge, approve/reject + note |
| `SEOIssueCard` | severity, category, affected URLs, fix action |
| `ContentEditor` | markdown/rich editor, live SEO score sidebar, keyword usage meter, FAQ/schema tabs |
| `AutomationCard` | rule name, schedule, level, enabled toggle, last run result, run-now |

## Empty and honest states

The dashboard must never invent numbers. litenatures.in genuinely has **0 clicks**, so:
CTR card shows `0%` with the note "no clicks recorded in this period", the fitted CTR curve is
unavailable so quick-win potentials are shown as ranges labelled *estimate*, and GA4 cards show a
connect prompt rather than zeros. Every card has three states: loading skeleton, empty-with-reason,
data.
