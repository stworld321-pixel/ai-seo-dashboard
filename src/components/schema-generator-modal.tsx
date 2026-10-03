"use client";

import { useState } from "react";
import {
  Code,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
  Building2,
  ShoppingBag,
  FileText,
  X,
} from "lucide-react";

export type SchemaType = "FAQPage" | "Product" | "Article" | "LocalBusiness";

interface SchemaGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: SchemaType;
  initialData?: {
    url?: string;
    title?: string;
    description?: string;
  };
}

export function SchemaGeneratorModal({
  isOpen,
  onClose,
  initialType = "FAQPage",
  initialData,
}: SchemaGeneratorModalProps) {
  const [schemaType, setSchemaType] = useState<SchemaType>(initialType);
  const [copied, setCopied] = useState(false);

  // FAQ State
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([
    {
      question: "What makes traditional wood-pressed oil different from refined oil?",
      answer: "Traditional wood-pressed (Marachekku) oil is extracted mechanically at room temperature without synthetic solvents like hexane or chemical bleaching, preserving 100% of natural polyphenols and heart-healthy antioxidants.",
    },
    {
      question: "Is cold-pressed oil safe for daily Indian cooking and deep frying?",
      answer: "Yes, traditional wood-pressed groundnut and sesame oils have naturally high smoke points (around 160°C to 190°C), making them ideal for traditional sautéing, curries, and medium-heat cooking without thermal degradation.",
    },
  ]);

  // Product State
  const [product, setProduct] = useState({
    name: initialData?.title || "Pure Vedic A2 Gir Cow Bilona Ghee (500ml)",
    description: initialData?.description || "Traditional bilona ghee hand-churned from curd of grass-fed Gir cows.",
    sku: "F2H-GHEE-500",
    price: "899",
    currency: "INR",
    availability: "https://schema.org/InStock",
    brand: "Farm 2 Home",
    ratingValue: "4.9",
    reviewCount: "128",
  });

  // Article State
  const [article, setArticle] = useState({
    headline: initialData?.title || "10 Proven Health Benefits of A2 Cow Cultured Bilona Ghee",
    description: initialData?.description || "Scientific evidence behind Vedic A2 ghee, gut microbiome support, and anti-inflammatory properties.",
    author: "Farm 2 Home Nutrition Advisory",
    datePublished: new Date().toISOString().slice(0, 10),
    url: initialData?.url || "https://farmm2home.com/blog/benefits-of-a2-cow-ghee/",
  });

  // LocalBusiness State
  const [localBiz, setLocalBiz] = useState({
    name: "Farm 2 Home Organics Chennai",
    telephone: "+91 98401 23456",
    streetAddress: "42, 2nd Avenue, Anna Nagar",
    addressLocality: "Chennai",
    postalCode: "600040",
    addressCountry: "IN",
    priceRange: "₹₹",
    areaServed: "Chennai Metropolitan Area, Anna Nagar, Adyar, Kilpauk, OMR",
  });

  if (!isOpen) return null;

  // Generate structured JSON-LD
  let jsonLdObj: Record<string, unknown> = {};

  if (schemaType === "FAQPage") {
    jsonLdObj = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    };
  } else if (schemaType === "Product") {
    jsonLdObj = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description,
      sku: product.sku,
      brand: {
        "@type": "Brand",
        name: product.brand,
      },
      offers: {
        "@type": "Offer",
        price: product.price,
        priceCurrency: product.currency,
        availability: product.availability,
        url: initialData?.url || "https://farmm2home.com",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.ratingValue,
        reviewCount: product.reviewCount,
      },
    };
  } else if (schemaType === "Article") {
    jsonLdObj = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.headline,
      description: article.description,
      author: {
        "@type": "Person",
        name: article.author,
      },
      publisher: {
        "@type": "Organization",
        name: "Farm 2 Home",
        logo: {
          "@type": "ImageObject",
          url: "https://farmm2home.com/logo.png",
        },
      },
      datePublished: article.datePublished,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": article.url,
      },
    };
  } else if (schemaType === "LocalBusiness") {
    jsonLdObj = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: localBiz.name,
      telephone: localBiz.telephone,
      priceRange: localBiz.priceRange,
      address: {
        "@type": "PostalAddress",
        streetAddress: localBiz.streetAddress,
        addressLocality: localBiz.addressLocality,
        postalCode: localBiz.postalCode,
        addressCountry: localBiz.addressCountry,
      },
      areaServed: localBiz.areaServed.split(",").map((a) => a.trim()),
    };
  }

  const generatedCode = `<script type="application/ld+json">\n${JSON.stringify(jsonLdObj, null, 2)}\n</script>`;

  async function handleCopy() {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addFaq() {
    setFaqs([...faqs, { question: "", answer: "" }]);
  }

  function removeFaq(idx: number) {
    setFaqs(faqs.filter((_, i) => i !== idx));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-xs">
              <Code size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-[var(--color-foreground)] flex items-center gap-2">
                1-Click Structured Data (JSON-LD) Generator
                <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                  Google &amp; AI Answer Engine Validated
                </span>
              </h2>
              <p className="text-xs text-[var(--color-muted)]">
                Rich snippets for ChatGPT, Google Search &amp; Perplexity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Schema Type Switcher */}
        <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <button
            type="button"
            onClick={() => setSchemaType("FAQPage")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              schemaType === "FAQPage"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <HelpCircle size={14} />
            FAQPage Schema
          </button>
          <button
            type="button"
            onClick={() => setSchemaType("Product")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              schemaType === "Product"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <ShoppingBag size={14} />
            Product Schema
          </button>
          <button
            type="button"
            onClick={() => setSchemaType("Article")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              schemaType === "Article"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <FileText size={14} />
            Article / Blog Schema
          </button>
          <button
            type="button"
            onClick={() => setSchemaType("LocalBusiness")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              schemaType === "LocalBusiness"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <Building2 size={14} />
            Local Business &amp; Delivery
          </button>
        </div>

        {/* Content Body: Left Input Form, Right JSON Preview */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border)] overflow-y-auto flex-1 p-6 gap-6">
          {/* Form Area */}
          <div className="space-y-4 pr-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Customize Schema Properties
              </h3>
              {schemaType === "FAQPage" && (
                <button
                  type="button"
                  onClick={addFaq}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                  <Plus size={13} />
                  Add Question
                </button>
              )}
            </div>

            {/* FAQ Form */}
            {schemaType === "FAQPage" && (
              <div className="space-y-3.5">
                {faqs.map((f, idx) => (
                  <div key={idx} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--color-muted)]">Question #{idx + 1}</span>
                      {faqs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFaq(idx)}
                          className="text-red-500 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) => {
                        const copy = [...faqs];
                        copy[idx].question = e.target.value;
                        setFaqs(copy);
                      }}
                      placeholder="e.g. Is this product 100% organic certified?"
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                    <textarea
                      rows={2}
                      value={f.answer}
                      onChange={(e) => {
                        const copy = [...faqs];
                        copy[idx].answer = e.target.value;
                        setFaqs(copy);
                      }}
                      placeholder="Detailed factual answer..."
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Product Form */}
            {schemaType === "Product" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Product Name</label>
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => setProduct({ ...product, name: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Description</label>
                  <textarea
                    rows={2}
                    value={product.description}
                    onChange={(e) => setProduct({ ...product, description: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Price (INR)</label>
                    <input
                      type="text"
                      value={product.price}
                      onChange={(e) => setProduct({ ...product, price: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">SKU / Item Code</label>
                    <input
                      type="text"
                      value={product.sku}
                      onChange={(e) => setProduct({ ...product, sku: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Rating (1-5)</label>
                    <input
                      type="text"
                      value={product.ratingValue}
                      onChange={(e) => setProduct({ ...product, ratingValue: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Reviews Count</label>
                    <input
                      type="text"
                      value={product.reviewCount}
                      onChange={(e) => setProduct({ ...product, reviewCount: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Article Form */}
            {schemaType === "Article" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Article Headline</label>
                  <input
                    type="text"
                    value={article.headline}
                    onChange={(e) => setArticle({ ...article, headline: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Summary / Description</label>
                  <textarea
                    rows={2}
                    value={article.description}
                    onChange={(e) => setArticle({ ...article, description: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Author Name</label>
                    <input
                      type="text"
                      value={article.author}
                      onChange={(e) => setArticle({ ...article, author: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Date Published</label>
                    <input
                      type="date"
                      value={article.datePublished}
                      onChange={(e) => setArticle({ ...article, datePublished: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Local Business Form */}
            {schemaType === "LocalBusiness" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Business / Hub Name</label>
                  <input
                    type="text"
                    value={localBiz.name}
                    onChange={(e) => setLocalBiz({ ...localBiz, name: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Street Address</label>
                  <input
                    type="text"
                    value={localBiz.streetAddress}
                    onChange={(e) => setLocalBiz({ ...localBiz, streetAddress: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Locality / City</label>
                    <input
                      type="text"
                      value={localBiz.addressLocality}
                      onChange={(e) => setLocalBiz({ ...localBiz, addressLocality: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-[var(--color-muted)]">Postal Code</label>
                    <input
                      type="text"
                      value={localBiz.postalCode}
                      onChange={(e) => setLocalBiz({ ...localBiz, postalCode: e.target.value })}
                      className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-medium text-[var(--color-muted)]">Delivery Suburbs / Areas Served (comma-separated)</label>
                  <input
                    type="text"
                    value={localBiz.areaServed}
                    onChange={(e) => setLocalBiz({ ...localBiz, areaServed: e.target.value })}
                    className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Code Output Area */}
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                Ready-to-Deploy JSON-LD
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="https://search.google.com/test/rich-results"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  <span>Google Validator</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <div className="relative flex-1 min-h-[260px] rounded-lg border border-[var(--color-border)] bg-zinc-950 p-3 font-mono text-[11px] text-zinc-100 overflow-auto">
              <pre className="whitespace-pre-wrap">{generatedCode}</pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[var(--color-muted)]">
                Inject into &lt;head&gt; or via WordPress SEO plugins.
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 transition-opacity shadow-sm"
              >
                {copied ? <Check size={14} className="text-[var(--color-success)]" /> : <Copy size={14} />}
                <span>{copied ? "Copied Script!" : "Copy JSON-LD Code"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
