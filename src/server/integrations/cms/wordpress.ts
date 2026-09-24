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
 * Verified against litenatures.in:
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
    const res = await fetch(`${this.base}/wp-json${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      // Never echo the Authorization header or credentials into an error.
      throw new Error(
        `WordPress ${init?.method ?? "GET"} ${path} failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
  }

  private toItem(w: WpItem): CmsItem {
    const meta = (w.meta ?? {}) as Record<string, string>;
    const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
    return {
      id: String(w.id),
      type: w.type,
      slug: w.slug,
      url: w.link,
      title: w.title?.rendered ?? "",
      seoTitle: str(meta[SEO_FIELDS.title]),
      metaDescription: str(meta[SEO_FIELDS.description]),
      focusKeyword: str(meta[SEO_FIELDS.focusKeyword]),
      content: w.content?.rendered,
      modifiedAt: w.modified,
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
    const items = await this.request<WpItem[]>(`/wp/v2/${type}?${qs}`);
    return items.map((w) => this.toItem(w));
  }

  /**
   * Resolves a live URL to its CMS item by slug. Tries products first
   * (WooCommerce sites rank mostly on product URLs), then posts and pages.
   */
  async getByUrl(url: string): Promise<CmsItem | null> {
    const slug = new URL(url).pathname.replace(/\/+$/, "").split("/").pop();
    if (!slug) return null;

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
    const endpoint = item?.type === "product" ? "product" : `${item?.type ?? "post"}s`;

    await this.request(`/wp/v2/${endpoint}/${id}`, {
      method: "POST",
      body: JSON.stringify({ meta }),
    });
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
    return null;
  }
}
