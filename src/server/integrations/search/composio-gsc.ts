import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { SearchRow } from "@/lib/types";
import {
  GSC_MAX_ROW_LIMIT,
  type GscProperty,
  type GscQueryParams,
  type SearchDataProvider,
  type UrlInspection,
} from "./provider";

const exec = promisify(execFile);

/**
 * Phase 1 Search Console access via the Composio CLI, which is already
 * authenticated on this machine (connected account ca_K9RLte-6XvMx).
 *
 * Why the CLI rather than the HTTP API: it works today with zero extra
 * credentials, which let the whole pipeline be verified against real data
 * before committing to an API-key deployment story. `NativeGscProvider`
 * (Phase 2) implements the same interface over Google OAuth; nothing above
 * this file changes when we switch.
 *
 * Behaviours verified against live litenatures.in responses:
 *  - `rows` is ABSENT (not empty) when there is no data — never assume an array
 *  - the last ~3 days are incomplete, so callers re-pull a trailing window
 *  - INSPECT_URL intermittently returns 500 and must be retried
 */

const MAX_BUFFER = 64 * 1024 * 1024; // large dimension pulls exceed the default 1MB

type ComposioEnvelope<T> = {
  successful: boolean;
  data?: T;
  error?: string | null;
  /**
   * Composio offloads large responses to a temp file rather than inlining
   * them, so `data` is undefined and the real payload lives at
   * `outputFilePath`. This is NOT an error state — it is the normal path for
   * any multi-dimension pull big enough to matter.
   */
  storedInFile?: boolean;
  outputFilePath?: string;
};

export class ComposioGscProvider implements SearchDataProvider {
  constructor(
    private readonly options: {
      /** Composio connected account id or alias. Optional: uses the default. */
      account?: string;
      /** Path to the composio binary. */
      bin?: string;
      timeoutMs?: number;
    } = {},
  ) {}

  private async run<T>(slug: string, data: Record<string, unknown>): Promise<T> {
    const bin = this.options.bin ?? "composio";
    const args = [
      "execute",
      slug,
      "-d",
      JSON.stringify(data),
      ...(this.options.account ? ["--account", this.options.account] : []),
    ];

    const { stdout } = await exec(bin, args, {
      maxBuffer: MAX_BUFFER,
      timeout: this.options.timeoutMs ?? 120_000,
    });

    let parsed: ComposioEnvelope<T>;
    try {
      parsed = JSON.parse(stdout) as ComposioEnvelope<T>;
    } catch {
      throw new Error(
        `Composio returned non-JSON for ${slug}: ${stdout.slice(0, 300)}`,
      );
    }
    if (!parsed.successful) {
      throw new Error(`Composio ${slug} failed: ${parsed.error ?? "unknown error"}`);
    }

    // Large payloads are written to a temp file and must be read back.
    if (parsed.data === undefined && parsed.outputFilePath) {
      const raw = await readFile(parsed.outputFilePath, "utf8");
      const fromFile = JSON.parse(raw) as ComposioEnvelope<T>;
      if (!fromFile.successful) {
        throw new Error(
          `Composio ${slug} failed in offloaded result: ${fromFile.error ?? "unknown error"}`,
        );
      }
      return fromFile.data as T;
    }

    return parsed.data as T;
  }

  /** Retry wrapper for the endpoints Google returns transient 500s from. */
  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (i < attempts - 1) {
          const backoff = 500 * 2 ** i + Math.random() * 250;
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    throw lastError;
  }

  async listProperties(): Promise<GscProperty[]> {
    const data = await this.run<{
      siteEntry?: { siteUrl: string; permissionLevel: string }[];
    }>("GOOGLE_SEARCH_CONSOLE_LIST_SITES", {});
    return (data.siteEntry ?? []).map((s) => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
  }

  /**
   * Fetches all rows for the given dimensions, paginating until Google returns
   * fewer rows than requested.
   */
  async query(params: GscQueryParams): Promise<SearchRow[]> {
    const pageSize = Math.min(params.rowLimit ?? GSC_MAX_ROW_LIMIT, GSC_MAX_ROW_LIMIT);
    const all: SearchRow[] = [];
    let startRow = params.startRow ?? 0;

    for (;;) {
      const data = await this.withRetry(() =>
        this.run<{ rows?: SearchRow[] }>(
          "GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY",
          {
            site_url: params.siteUrl,
            start_date: params.startDate,
            end_date: params.endDate,
            dimensions: params.dimensions,
            row_limit: pageSize,
            start_row: startRow,
            ...(params.dataState ? { data_state: params.dataState } : {}),
          },
        ),
      );

      // `rows` is genuinely absent when a property has no data in the window.
      const rows = data.rows ?? [];
      all.push(...rows);
      if (rows.length < pageSize) break;
      startRow += rows.length;
      if (params.rowLimit && all.length >= params.rowLimit) break;
    }

    return all;
  }

  async inspectUrl(params: {
    siteUrl: string;
    inspectionUrl: string;
  }): Promise<UrlInspection> {
    const data = await this.withRetry(() =>
      this.run<{
        inspectionResult?: {
          indexStatusResult?: Record<string, string>;
          inspectionResultLink?: string;
        };
      }>("GOOGLE_SEARCH_CONSOLE_INSPECT_URL", {
        site_url: params.siteUrl,
        inspection_url: params.inspectionUrl,
      }),
    );

    const r = data.inspectionResult?.indexStatusResult ?? {};
    return {
      verdict: r.verdict ?? null,
      coverageState: r.coverageState ?? null,
      indexingState: r.indexingState ?? null,
      robotsTxtState: r.robotsTxtState ?? null,
      googleCanonical: r.googleCanonical ?? null,
      userCanonical: r.userCanonical ?? null,
      lastCrawlTime: r.lastCrawlTime ?? null,
      inspectionResultLink: data.inspectionResult?.inspectionResultLink ?? null,
      raw: data,
    };
  }
}
