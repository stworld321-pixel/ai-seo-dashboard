import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 12,483 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

/** 3.81% */
export function formatPercent(fraction: number, dp = 2): string {
  return `${(fraction * 100).toFixed(dp)}%`;
}

/** 8.2 */
export function formatPosition(p: number): string {
  return p.toFixed(1);
}

/**
 * Percentage delta between two values, or null when the baseline is zero
 * (an increase from 0 is not "+100%", it is undefined — and printing a number
 * there would be one of the invented figures this product refuses to show).
 */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function formatDelta(d: number | null): string {
  if (d === null) return "—";
  const sign = d > 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(1)}%`;
}

/** Shortens a URL for table display: /product/charcoal-soap/ */
export function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

const COUNTRY_NAMES: Record<string, string> = {
  ind: "India",
  usa: "United States",
  gbr: "United Kingdom",
  aus: "Australia",
  can: "Canada",
  are: "UAE",
  pak: "Pakistan",
  nga: "Nigeria",
  deu: "Germany",
  fra: "France",
  esp: "Spain",
  egy: "Egypt",
  bgd: "Bangladesh",
  gha: "Ghana",
  zaf: "South Africa",
  mys: "Malaysia",
  sgp: "Singapore",
  lka: "Sri Lanka",
  npl: "Nepal",
  idn: "Indonesia",
};

/** GSC returns ISO-3 lowercase codes; map the common ones to readable names. */
export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function relativeTime(date: Date | null): string {
  if (!date) return "never";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
