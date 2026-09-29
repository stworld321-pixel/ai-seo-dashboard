"use client";

import { useState } from "react";
import { Download, Copy, Check, FileText, Code2, Sparkles } from "lucide-react";

export function ManualExportPanel() {
  const [copied, setCopied] = useState<string | null>(null);

  const sampleMarkdown = `# Comprehensive Buyer Guide: Best Organic Handmade Soap in India

## Quick Summary
Cold-processed handmade soaps retain natural botanical glycerin formed during saponification, providing gentle skin hydration without sulfates or artificial hardeners.

## Key Takeaways
- **Process**: Traditional 4–6 week cold process cure
- **Ingredients**: Saponified virgin coconut oil, olive oil, natural plant extracts
- **Standards**: Formulated according to Ayush cosmetic guidelines

## Frequently Asked Questions
### What makes cold-processed soap different from commercial bars?
Commercial bars extract glycerin for industrial use. Cold-processed soaps retain 100% natural glycerin.
`;

  function handleCopy(type: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleDownload(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleCopy("markdown", sampleMarkdown)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-border)] transition-colors"
        >
          {copied === "markdown" ? <Check size={14} className="text-[var(--color-success)]" /> : <Copy size={14} />}
          {copied === "markdown" ? "Copied Markdown!" : "Copy Markdown"}
        </button>

        <button
          type="button"
          onClick={() => handleDownload("article-export.md", sampleMarkdown, "text/markdown")}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-border)] transition-colors"
        >
          <Download size={14} /> Download Markdown (.md)
        </button>

        <button
          type="button"
          onClick={() => handleDownload("article-export.html", `<html><body>${sampleMarkdown}</body></html>`, "text/html")}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-border)] transition-colors"
        >
          <Code2 size={14} /> Download HTML (.html)
        </button>

        <button
          type="button"
          onClick={() =>
            handleDownload(
              "schema-export.json",
              JSON.stringify(
                {
                  "@context": "https://schema.org",
                  "@type": "Article",
                  headline: "Comprehensive Buyer Guide: Best Organic Handmade Soap",
                },
                null,
                2,
              ),
              "application/json",
            )
          }
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-border)] transition-colors"
        >
          <Sparkles size={14} /> Export Schema JSON-LD
        </button>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 font-mono text-xs text-[var(--color-foreground)] max-h-48 overflow-y-auto leading-relaxed">
        <pre className="whitespace-pre-wrap">{sampleMarkdown}</pre>
      </div>
    </div>
  );
}
