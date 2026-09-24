/**
 * CMS integration contract.
 *
 * Deliberately has NO delete method. An agent must not be able to remove
 * content from a live site, so the capability does not exist in the type
 * system (docs/09-security.md).
 */

export type CmsCapabilities = {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canUpdateSeoMeta: boolean;
  canInjectSchema: boolean;
};

export type CmsItem = {
  id: string;
  type: string; // post | page | product
  slug: string;
  url: string;
  title: string;
  /** SEO title (Rank Math / Yoast), distinct from the post title. */
  seoTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  content?: string;
  modifiedAt: string;
};

export type SeoMetaPatch = {
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
};

export interface CmsProvider {
  readonly name: string;
  capabilities(): CmsCapabilities;
  /** Verifies credentials and returns the authenticated user's name. */
  verify(): Promise<{ ok: boolean; user?: string; error?: string }>;
  listContent(params?: { type?: string; search?: string; limit?: number }): Promise<CmsItem[]>;
  getByUrl(url: string): Promise<CmsItem | null>;
  /** Updates SEO fields only. Content edits are a separate, gated operation. */
  updateSeoMeta(id: string, patch: SeoMetaPatch): Promise<void>;
}
