import type {
  CmsCapabilities,
  CmsItem,
  CmsProvider,
  SeoMetaPatch,
} from "./provider";

/**
 * Self-hosted WordPress via the REST API, authenticated with an Application
 * Password (Users → Profile → Application Passwords). Composio only covers
 * WordPress.com, so self-hosted sites use this adapter.
 *
 * Verified against live WordPress REST API:
 *  - WooCommerce store: SEO targets are `product` post type, not `post`
 *  - Rank Math is installed and exposes rank_math_title /
 *    rank_math_description / rank_math_focus_keyword through `meta`
 *  - Yoast fields (_yoast_wpseo_*) are also present but empty; Rank Math wins
 *
 * Reads work unauthenticated; writes require the application password.
 */

const SEO_FIELDS = {
  title: "rank_math_title",
  description: "rank_math_description",
  focusKeyword: "rank_math_focus_keyword",
} as const;

type WpItem = {
  id: number;
  slug: string;
  link: string;
  type: string;
  modified: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  meta?: Record<string, unknown>;
};

type WcMetaEntry = {
  id?: number;
  key: string;
  value: unknown;
};

type WcProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  status: string;
  date_modified: string;
  description?: string;
  price?: string;
  total_sales?: number;
  stock_status?: string;
  meta_data?: WcMetaEntry[];
};

export type LiveWooOrderSummary = {
  id: number;
  status: string;
  dateCreated: string;
  total: number;
  currency: string;
  customerName: string;
  city: string;
  items: string[];
};

export type LiveSiteTelemetry = {
  ga4: {
    connected: boolean;
    accountId: string | null;
    propertyId: string | null;
    measurementId: string | null;
    webDataStreamId: string | null;
    googleTagId: string | null;
  } | null;
  woocommerce: {
    totalOrders: number;
    activeOrders: number;
    activeRevenue: number;
    grossOrderValue: number;
    unitsSold: number;
    currency: string;
    recentOrders: LiveWooOrderSummary[];
    totalProducts: number;
    publishedProducts: number;
    unpublishedProducts: number;
    avgRankMathScore: number;
  } | null;
  rankMathLinks: {
    totalPosts: number;
    orphanPosts: number;
    postsWithInternal: number;
    postsWithExternal: number;
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    posts: {
      postId: string;
      title: string;
      postType: string;
      url: string;
      internalLinks: number;
      externalLinks: number;
      incomingLinks: number;
      isOrphan: boolean;
      seoScore: number;
    }[];
    links: {
      id: string;
      type: string;
      sourceTitle: string;
      sourceUrl: string;
      targetTitle: string | null;
      targetUrl: string;
    }[];
  } | null;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8217;/g, "’");
}

export class WordPressProvider implements CmsProvider {
  readonly name = "wordpress";
  private readonly base: string;

  constructor(
    private readonly options: {
      siteUrl: string;
      username?: string;
      /** Application password. Never logged, never returned. */
      appPassword?: string;
      timeoutMs?: number;
    },
  ) {
    this.base = options.siteUrl.replace(/\/+$/, "");
  }

  private get authed(): boolean {
    return Boolean(this.options.username && this.options.appPassword);
  }

  capabilities(): CmsCapabilities {
    return {
      canRead: true,
      canCreate: false, // deliberately not implemented yet
      canUpdate: this.authed,
      canUpdateSeoMeta: this.authed,
      canInjectSchema: false,
    };
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.authed) {
      const token = Buffer.from(
        `${this.options.username}:${this.options.appPassword}`,
      ).toString("base64");
      h.Authorization = `Basic ${token}`;
    }
    return h;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.base}/wp-json${path}`;
    const mergedHeaders: Record<string, string> = {
      ...this.headers(),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    const opts: RequestInit = {
      ...init,
      headers: mergedHeaders,
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    };

    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `WordPress ${init?.method ?? "GET"} ${path} failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
        );
      }
      return (await res.json()) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const causeCode = (err as { cause?: { code?: string } })?.cause?.code;
      if (
        msg.includes("fetch failed") ||
        causeCode === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
        causeCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        causeCode === "SELF_SIGNED_CERT_IN_CHAIN" ||
        causeCode === "DEPTH_ZERO_SELF_SIGNED_CERT"
      ) {
        const https = await import("node:https");
        const method = init?.method ?? "GET";
        const bodyPayload = typeof init?.body === "string" ? init.body : undefined;
        const { statusCode, statusMessage, rawBody } = await new Promise<{
          statusCode: number;
          statusMessage: string;
          rawBody: string;
        }>((resolve, reject) => {
          const req = https.request(
            url,
            {
              method,
              headers: {
                ...mergedHeaders,
                ...(bodyPayload ? { "Content-Length": String(Buffer.byteLength(bodyPayload)) } : {}),
              },
              rejectUnauthorized: false,
              timeout: this.options.timeoutMs ?? 30_000,
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (c) => chunks.push(Buffer.from(c)));
              res.on("end", () =>
                resolve({
                  statusCode: res.statusCode ?? 500,
                  statusMessage: res.statusMessage ?? "",
                  rawBody: Buffer.concat(chunks).toString("utf8"),
                }),
              );
            },
          );
          req.on("error", reject);
          req.on("timeout", () => req.destroy(new Error("WordPress request timed out")));
          if (bodyPayload) req.write(bodyPayload);
          req.end();
        });

        if (statusCode < 200 || statusCode >= 300) {
          throw new Error(
            `WordPress ${method} ${path} failed: ${statusCode} ${statusMessage} — ${rawBody.slice(0, 300)}`,
          );
        }
        return JSON.parse(rawBody) as T;
      }
      throw err;
    }
  }

  private toItem(w: WpItem): CmsItem {
    const meta = (w.meta ?? {}) as Record<string, string>;
    const str = (v: unknown) =>
      typeof v === "string" && v.length > 0 ? decodeHtmlEntities(v) : null;
    return {
      id: String(w.id),
      type: w.type,
      slug: w.slug,
      url: w.link,
      title: decodeHtmlEntities(w.title?.rendered ?? ""),
      seoTitle: str(meta[SEO_FIELDS.title]),
      metaDescription: str(meta[SEO_FIELDS.description]),
      focusKeyword: str(meta[SEO_FIELDS.focusKeyword]),
      content: w.content?.rendered,
      modifiedAt: w.modified,
    };
  }

  private wcToItem(p: WcProduct): CmsItem {
    const metaMap = new Map<string, string>();
    for (const m of p.meta_data ?? []) {
      if (typeof m.value === "string" && m.value.trim().length > 0) {
        metaMap.set(m.key, decodeHtmlEntities(m.value.trim()));
      }
    }
    const canonicalUrl =
      p.permalink && !p.permalink.includes("?post_type=product")
        ? p.permalink
        : `${this.base}/product/${p.slug}/`;
    return {
      id: String(p.id),
      type: "product",
      slug: p.slug,
      url: canonicalUrl,
      title: decodeHtmlEntities(p.name),
      seoTitle: metaMap.get(SEO_FIELDS.title) ?? null,
      metaDescription: metaMap.get(SEO_FIELDS.description) ?? null,
      focusKeyword: metaMap.get(SEO_FIELDS.focusKeyword) ?? null,
      content: p.description,
      modifiedAt: p.date_modified,
    };
  }

  async verify(): Promise<{ ok: boolean; user?: string; error?: string }> {
    if (!this.authed) {
      return { ok: false, error: "No username/application password configured" };
    }
    try {
      const me = await this.request<{ name?: string; slug?: string }>("/wp/v2/users/me");
      return { ok: true, user: me.name ?? me.slug };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listContent(
    params: { type?: string; search?: string; limit?: number } = {},
  ): Promise<CmsItem[]> {
    const type = params.type ?? "product";
    const qs = new URLSearchParams({
      per_page: String(Math.min(params.limit ?? 100, 100)),
      ...(params.search ? { search: params.search } : {}),
    });

    if (type === "product" && this.authed) {
      try {
        const wcProducts = await this.request<WcProduct[]>(`/wc/v3/products?${qs}`);
        if (Array.isArray(wcProducts) && wcProducts.length > 0) {
          return wcProducts.map((p) => this.wcToItem(p));
        }
      } catch {
        // Fall back to /wp/v2/product below
      }
    }

    const items = await this.request<WpItem[]>(`/wp/v2/${type}?${qs}`);
    return items.map((w) => this.toItem(w));
  }

  /**
   * Resolves a live URL to its CMS item by slug. Tries products first
   * (WooCommerce sites rank mostly on product URLs), then posts and pages.
   */
  async getByUrl(url: string): Promise<CmsItem | null> {
    const parsedUrl = new URL(url);
    const cleanPath = parsedUrl.pathname.replace(/\/+$/, "");
    const slug = cleanPath.split("/").pop();

    // Root/homepage URL ("/") has no path slug; resolve by matching canonical link on pages.
    if (!slug) {
      try {
        const normalizedTarget = `${parsedUrl.origin}/`;
        const pages = await this.request<WpItem[]>("/wp/v2/pages?per_page=20");
        const home = pages.find(
          (p) => p.link.replace(/\/+$/, "") === normalizedTarget.replace(/\/+$/, ""),
        );
        if (home) return this.toItem(home);
      } catch {
        // Ignore and return null if pages endpoint fails
      }
      return null;
    }

    if (this.authed && cleanPath.includes("/product/")) {
      try {
        const wcItems = await this.request<WcProduct[]>(
          `/wc/v3/products?slug=${encodeURIComponent(slug)}`,
        );
        if (Array.isArray(wcItems) && wcItems.length > 0) {
          return this.wcToItem(wcItems[0]!);
        }
      } catch {
        // Fall through to standard /wp/v2 lookup
      }
    }

    for (const type of ["product", "posts", "pages"]) {
      try {
        const items = await this.request<WpItem[]>(
          `/wp/v2/${type}?slug=${encodeURIComponent(slug)}`,
        );
        if (items.length > 0) return this.toItem(items[0]!);
      } catch {
        // Post type not registered on this site; try the next one.
      }
    }
    return null;
  }

  async updateSeoMeta(id: string, patch: SeoMetaPatch): Promise<void> {
    if (!this.authed) {
      throw new Error(
        "WordPress writes require an application password. Set WP_USERNAME and WP_APP_PASSWORD.",
      );
    }

    const meta: Record<string, string> = {};
    if (patch.seoTitle !== undefined) meta[SEO_FIELDS.title] = patch.seoTitle;
    if (patch.metaDescription !== undefined) {
      meta[SEO_FIELDS.description] = patch.metaDescription;
    }
    if (patch.focusKeyword !== undefined) {
      meta[SEO_FIELDS.focusKeyword] = patch.focusKeyword;
    }
    if (Object.keys(meta).length === 0) return;

    // Determine the post type so we hit the right endpoint.
    const item = await this.findById(id);
    if (!item) {
      throw new Error(`WordPress item ${id} not found across product, posts, or pages.`);
    }
    const endpoint = item.type === "product" ? "product" : `${item.type}s`;

    await this.request(`/wp/v2/${endpoint}/${id}`, {
      method: "POST",
      body: JSON.stringify({ meta }),
    });

    if (item.type === "product") {
      try {
        const metaData = Object.entries(meta).map(([key, value]) => ({ key, value }));
        await this.request(`/wc/v3/products/${id}`, {
          method: "PUT",
          body: JSON.stringify({ meta_data: metaData }),
        });
      } catch {
        // Ignore if WooCommerce v3 endpoint is unavailable
      }
    }
  }

  private injectInternalLinkHtml(
    rawHtml: string,
    targetUrl: string,
    anchor: string,
  ): { html: string; changed: boolean; mode: "already-linked" | "inline-anchor" | "contextual-callout" } {
    const html = rawHtml ?? "";
    const cleanTarget = targetUrl.trim().replace(/\/+$/, "").toLowerCase();
    let targetPath = "";
    try {
      targetPath = new URL(targetUrl).pathname.replace(/\/+$/, "").toLowerCase();
    } catch {
      targetPath = cleanTarget;
    }

    // 1. Check if an <a> tag pointing to targetUrl already exists
    const hrefRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = hrefRegex.exec(html)) !== null) {
      const existingHref = (match[1] ?? "").trim().replace(/\/+$/, "").toLowerCase();
      if (
        existingHref === cleanTarget ||
        (targetPath.length > 1 && existingHref.endsWith(targetPath))
      ) {
        return { html, changed: false, mode: "already-linked" };
      }
    }

    const cleanAnchor = anchor.trim();
    const escapedAnchor = cleanAnchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const anchorRegex = new RegExp(`\\b(${escapedAnchor})\\b`, "i");

    // 2. Try linking the first natural occurrence in plain text (outside <a>, <h1-h6>, and HTML tags)
    const tokenRegex = /(<a\b[^>]*>[\s\S]*?<\/a>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<[^>]+>)/gi;
    const parts = html.split(tokenRegex);
    let replacedInline = false;

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i]!;
      if (segment.startsWith("<")) continue;
      if (anchorRegex.test(segment)) {
        parts[i] = segment.replace(
          anchorRegex,
          `<a href="${targetUrl}" style="text-decoration:underline;font-weight:500;">$1</a>`,
        );
        replacedInline = true;
        break;
      }
    }

    if (replacedInline) {
      return { html: parts.join(""), changed: true, mode: "inline-anchor" };
    }

    // 3. Append a clean contextual internal link paragraph so the link is visible on the live page and indexed by Rank Math
    const callout = `<p class="ai-seo-internal-link">Also explore our <a href="${targetUrl}" style="text-decoration:underline;font-weight:500;">${cleanAnchor}</a> for natural daily skincare &amp; haircare.</p>`;
    const joined = html.trim().length > 0 ? `${html.trim()}\n${callout}\n` : `${callout}\n`;
    return { html: joined, changed: true, mode: "contextual-callout" };
  }

  /**
   * Injects an internal link (<a href="targetUrl">anchor</a>) into the live WordPress / WooCommerce
   * sourceUrl item (updating both product description & short_description for WooCommerce products,
   * or post/page content for standard WordPress entries).
   */
  async applyInternalLink(params: {
    sourceUrl: string;
    targetUrl: string;
    anchor: string;
  }): Promise<{
    cmsId: string;
    postType: string;
    sourceUrl: string;
    targetUrl: string;
    anchor: string;
    changed: boolean;
    mode: "already-linked" | "inline-anchor" | "contextual-callout";
  }> {
    if (!this.authed) {
      throw new Error(
        "WordPress writes require an application password. Set WP_USERNAME and WP_APP_PASSWORD.",
      );
    }

    const item = await this.getByUrl(params.sourceUrl);
    if (!item) {
      throw new Error(`Source page not found in WordPress for URL: ${params.sourceUrl}`);
    }

    if (item.type === "product") {
      const wcProduct = await this.request<{
        id: number;
        description?: string;
        short_description?: string;
      }>(`/wc/v3/products/${item.id}`);

      const descRes = this.injectInternalLinkHtml(
        wcProduct.description ?? item.content ?? "",
        params.targetUrl,
        params.anchor,
      );
      const shortRes = this.injectInternalLinkHtml(
        wcProduct.short_description ?? "",
        params.targetUrl,
        params.anchor,
      );

      if (descRes.changed || shortRes.changed) {
        await this.request(`/wc/v3/products/${item.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...(descRes.changed ? { description: descRes.html } : {}),
            ...(shortRes.changed ? { short_description: shortRes.html } : {}),
          }),
        });

        // Also trigger WP v2 product update so Rank Math's save_post link counter re-indexes immediately
        try {
          await this.request(`/wp/v2/product/${item.id}`, {
            method: "POST",
            body: JSON.stringify({
              ...(descRes.changed ? { content: descRes.html } : {}),
              ...(shortRes.changed ? { excerpt: shortRes.html } : {}),
            }),
          });
        } catch {
          // WC PUT already saved the content if WP v2 product endpoint rejects raw HTML
        }
      }

      return {
        cmsId: item.id,
        postType: item.type,
        sourceUrl: item.url,
        targetUrl: params.targetUrl,
        anchor: params.anchor,
        changed: descRes.changed || shortRes.changed,
        mode: descRes.changed ? descRes.mode : shortRes.mode,
      };
    }

    const endpoint = item.type === "product" ? "product" : `${item.type}s`;
    const wpEntry = await this.request<WpItem>(`/wp/v2/${endpoint}/${item.id}`);
    const currentHtml = wpEntry.content?.rendered ?? item.content ?? "";
    const res = this.injectInternalLinkHtml(currentHtml, params.targetUrl, params.anchor);

    if (res.changed) {
      await this.request(`/wp/v2/${endpoint}/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ content: res.html }),
      });
    }

    return {
      cmsId: item.id,
      postType: item.type,
      sourceUrl: item.url,
      targetUrl: params.targetUrl,
      anchor: params.anchor,
      changed: res.changed,
      mode: res.mode,
    };
  }

  /**
   * Publishes or updates a full SEO + AEO + GEO blog post on WordPress (/wp-json/wp/v2/posts)
   * complete with Rank Math SEO title, meta description, focus keyword, and HTML content.
   */
  async publishBlogPost(params: {
    title: string;
    slug?: string;
    htmlContent: string;
    excerpt?: string;
    seoTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    status?: "publish" | "draft";
  }): Promise<{ id: string; url: string; slug: string; status: string }> {
    if (!this.authed) {
      throw new Error(
        "WordPress writes require an application password. Set WP_USERNAME and WP_APP_PASSWORD.",
      );
    }

    const cleanSlug =
      params.slug?.trim() ||
      params.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const meta: Record<string, string> = {};
    if (params.seoTitle || params.title) {
      meta[SEO_FIELDS.title] = params.seoTitle ?? params.title;
    }
    if (params.metaDescription) {
      meta[SEO_FIELDS.description] = params.metaDescription;
    }
    if (params.focusKeyword) {
      meta[SEO_FIELDS.focusKeyword] = params.focusKeyword;
    }

    // Check if a post with this slug already exists so re-publishing updates it cleanly
    let existingId: number | null = null;
    try {
      const found = await this.request<WpItem[]>(
        `/wp/v2/posts?slug=${encodeURIComponent(cleanSlug)}&status=any`,
      );
      if (Array.isArray(found) && found.length > 0 && found[0]?.id) {
        existingId = found[0].id;
      }
    } catch {
      existingId = null;
    }

    const endpoint = existingId ? `/wp/v2/posts/${existingId}` : "/wp/v2/posts";
    const created = await this.request<WpItem>(endpoint, {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        slug: cleanSlug,
        status: params.status ?? "publish",
        content: params.htmlContent,
        ...(params.excerpt ? { excerpt: params.excerpt } : {}),
        meta,
      }),
    });

    return {
      id: String(created.id),
      url: created.link || `${this.base}/${cleanSlug}/`,
      slug: created.slug || cleanSlug,
      status: params.status ?? "publish",
    };
  }

  private async findById(id: string): Promise<CmsItem | null> {
    for (const type of ["product", "posts", "pages"]) {
      try {
        const w = await this.request<WpItem>(`/wp/v2/${type}/${id}`);
        return this.toItem(w);
      } catch {
        // Wrong post type; keep looking.
      }
    }
    if (this.authed) {
      try {
        const p = await this.request<WcProduct>(`/wc/v3/products/${id}`);
        if (p && p.id) return this.wcToItem(p);
      } catch {
        // Not a WC product
      }
    }
    return null;
  }

  /**
   * Pulls live Google Site Kit (GA4), WooCommerce Orders/Products, and Rank Math
   * Internal/External Link Graph telemetry from the connected WordPress site.
   */
  async fetchLiveSiteTelemetry(): Promise<LiveSiteTelemetry> {
    let ga4: LiveSiteTelemetry["ga4"] = null;
    let woocommerce: LiveSiteTelemetry["woocommerce"] = null;
    let rankMathLinks: LiveSiteTelemetry["rankMathLinks"] = null;

    if (!this.authed) {
      return { ga4, woocommerce, rankMathLinks };
    }

    const [ga4Res, ordersRes, productsRes, postsStatsRes, linksStatsRes, postsRes, linksRes] =
      await Promise.allSettled([
        this.request<{
          accountID?: string;
          propertyID?: string;
          measurementID?: string;
          webDataStreamID?: string;
          googleTagID?: string;
        }>("/google-site-kit/v1/modules/analytics-4/data/settings"),
        this.request<
          {
            id: number;
            status: string;
            date_created: string;
            total: string;
            currency: string;
            billing?: { first_name?: string; last_name?: string; city?: string; state?: string };
            line_items?: { name: string; quantity: number }[];
          }[]
        >("/wc/v3/orders?per_page=100"),
        this.request<WcProduct[]>("/wc/v3/products?per_page=100"),
        this.request<{
          total_posts?: number;
          orphan_posts?: number;
          posts_with_internal?: number;
          posts_with_external?: number;
        }>("/rankmath/v1/links/posts-stats"),
        this.request<{
          total?: number;
          internal?: number;
          external?: number;
        }>("/rankmath/v1/links/links-stats"),
        this.request<{
          posts?: {
            post_id: string;
            post_title: string;
            post_type: string;
            post_url: string;
            internal_link_count: number;
            external_link_count: number;
            incoming_link_count: number;
            is_orphan: boolean;
            seo_score: number;
          }[];
        }>("/rankmath/v1/links/posts"),
        this.request<{
          links?: {
            id: string;
            type: string;
            source_title: string;
            source_url: string;
            target_title: string | null;
            target_url: string;
          }[];
        }>("/rankmath/v1/links/links"),
      ]);

    if (ga4Res.status === "fulfilled" && ga4Res.value?.propertyID) {
      ga4 = {
        connected: true,
        accountId: ga4Res.value.accountID ?? null,
        propertyId: ga4Res.value.propertyID ?? null,
        measurementId: ga4Res.value.measurementID ?? null,
        webDataStreamId: ga4Res.value.webDataStreamID ?? null,
        googleTagId: ga4Res.value.googleTagID ?? null,
      };
    }

    if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) {
      const orders = ordersRes.value;
      const products =
        productsRes.status === "fulfilled" && Array.isArray(productsRes.value)
          ? productsRes.value
          : [];
      const activeStatuses = new Set(["completed", "processing", "on-hold"]);
      let activeOrders = 0;
      let activeRevenue = 0;
      let grossOrderValue = 0;
      let unitsSold = 0;

      for (const o of orders) {
        const val = Number.parseFloat(o.total || "0") || 0;
        grossOrderValue += val;
        if (activeStatuses.has(o.status)) {
          activeOrders += 1;
          activeRevenue += val;
          for (const li of o.line_items ?? []) {
            unitsSold += li.quantity || 0;
          }
        }
      }

      const scores: number[] = [];
      for (const p of products) {
        const scoreEntry = (p.meta_data ?? []).find((m) => m.key === "rank_math_seo_score");
        const n = Number.parseInt(String(scoreEntry?.value ?? ""), 10);
        if (Number.isFinite(n) && n > 0) scores.push(n);
      }

      woocommerce = {
        totalOrders: orders.length,
        activeOrders,
        activeRevenue,
        grossOrderValue,
        unitsSold,
        currency: orders[0]?.currency ?? "INR",
        recentOrders: orders.slice(0, 10).map((o) => ({
          id: o.id,
          status: o.status,
          dateCreated: o.date_created,
          total: Number.parseFloat(o.total || "0") || 0,
          currency: o.currency || "INR",
          customerName:
            [o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(" ") || "Guest",
          city: [o.billing?.city, o.billing?.state].filter(Boolean).join(", ") || "India",
          items: (o.line_items ?? []).map((i) => `${decodeHtmlEntities(i.name)} ×${i.quantity}`),
        })),
        totalProducts: products.length,
        publishedProducts: products.filter((p) => p.status === "publish").length,
        unpublishedProducts: products.filter((p) => p.status !== "publish").length,
        avgRankMathScore:
          scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      };
    }

    if (postsStatsRes.status === "fulfilled" && linksStatsRes.status === "fulfilled") {
      const ps = postsStatsRes.value;
      const ls = linksStatsRes.value;
      const rawPosts = postsRes.status === "fulfilled" ? (postsRes.value.posts ?? []) : [];
      const rawLinks = linksRes.status === "fulfilled" ? (linksRes.value.links ?? []) : [];
      rankMathLinks = {
        totalPosts: ps.total_posts ?? rawPosts.length,
        orphanPosts: ps.orphan_posts ?? rawPosts.filter((p) => p.is_orphan).length,
        postsWithInternal: ps.posts_with_internal ?? 0,
        postsWithExternal: ps.posts_with_external ?? 0,
        totalLinks: ls.total ?? rawLinks.length,
        internalLinks: ls.internal ?? 0,
        externalLinks: ls.external ?? 0,
        posts: rawPosts.map((p) => ({
          postId: p.post_id,
          title: decodeHtmlEntities(p.post_title),
          postType: p.post_type,
          url: p.post_url.startsWith("http") ? p.post_url : `${this.base}${p.post_url}`,
          internalLinks: Number(p.internal_link_count ?? 0),
          externalLinks: Number(p.external_link_count ?? 0),
          incomingLinks: Number(p.incoming_link_count ?? 0),
          isOrphan: Boolean(p.is_orphan),
          seoScore: Number(p.seo_score ?? 0),
        })),
        links: rawLinks.slice(0, 60).map((l) => ({
          id: l.id,
          type: l.type,
          sourceTitle: decodeHtmlEntities(l.source_title || ""),
          sourceUrl: l.source_url.startsWith("http") ? l.source_url : `${this.base}${l.source_url}`,
          targetTitle: l.target_title ? decodeHtmlEntities(l.target_title) : null,
          targetUrl: l.target_url
            ? l.target_url.startsWith("http")
              ? l.target_url
              : `${this.base}${l.target_url}`
            : "",
        })),
      };
    }

    return { ga4, woocommerce, rankMathLinks };
  }
}

