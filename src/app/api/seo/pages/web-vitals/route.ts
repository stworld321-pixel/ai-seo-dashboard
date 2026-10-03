import { NextRequest, NextResponse } from "next/server";

interface VitalsMetric {
  value: number;
  category: "FAST" | "AVERAGE" | "SLOW";
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl ? req.nextUrl.searchParams : new URL(req.url).searchParams;
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "url parameter required" },
      { status: 400 },
    );
  }

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=performance&strategy=mobile`;
    const res = await fetch(apiUrl, { next: { revalidate: 3600 } });

    if (!res.ok) {
      throw new Error(`PageSpeed API returned ${res.status}`);
    }

    const data = await res.json();
    const le = data.loadingExperience?.metrics;
    const perfScore = data.lighthouseResult?.categories?.performance?.score;

    const lcp: VitalsMetric = le?.LARGEST_CONTENTFUL_PAINT_MS
      ? {
          value: le.LARGEST_CONTENTFUL_PAINT_MS.percentile,
          category: le.LARGEST_CONTENTFUL_PAINT_MS.category,
        }
      : { value: 0, category: "FAST" };

    const inp: VitalsMetric = le?.INTERACTION_TO_NEXT_PAINT
      ? {
          value: le.INTERACTION_TO_NEXT_PAINT.percentile,
          category: le.INTERACTION_TO_NEXT_PAINT.category,
        }
      : le?.EXPERIMENTAL_INTERACTION_TO_NEXT_PAINT
        ? {
            value: le.EXPERIMENTAL_INTERACTION_TO_NEXT_PAINT.percentile,
            category: le.EXPERIMENTAL_INTERACTION_TO_NEXT_PAINT.category,
          }
        : { value: 0, category: "FAST" };

    const cls: VitalsMetric = le?.CUMULATIVE_LAYOUT_SHIFT_SCORE
      ? {
          value: le.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100,
          category: le.CUMULATIVE_LAYOUT_SHIFT_SCORE.category,
        }
      : { value: 0, category: "FAST" };

    const fcp: VitalsMetric = le?.FIRST_CONTENTFUL_PAINT_MS
      ? {
          value: le.FIRST_CONTENTFUL_PAINT_MS.percentile,
          category: le.FIRST_CONTENTFUL_PAINT_MS.category,
        }
      : { value: 0, category: "FAST" };

    return NextResponse.json({
      data: {
        performanceScore:
          perfScore != null ? Math.round(perfScore * 100) : null,
        lcp: {
          value: lcp.value,
          unit: "ms",
          category: lcp.category,
          label: "Largest Contentful Paint",
        },
        inp: {
          value: inp.value,
          unit: "ms",
          category: inp.category,
          label: "Interaction to Next Paint",
        },
        cls: {
          value: cls.value,
          unit: "",
          category: cls.category,
          label: "Cumulative Layout Shift",
        },
        fcp: {
          value: fcp.value,
          unit: "ms",
          category: fcp.category,
          label: "First Contentful Paint",
        },
        source: le ? "crux" : "lighthouse",
      },
    });
  } catch {
    // Fallback: return null values so the UI can show "not available"
    return NextResponse.json({
      data: {
        performanceScore: null,
        lcp: {
          value: null,
          unit: "ms",
          category: null,
          label: "Largest Contentful Paint",
        },
        inp: {
          value: null,
          unit: "ms",
          category: null,
          label: "Interaction to Next Paint",
        },
        cls: {
          value: null,
          unit: "",
          category: null,
          label: "Cumulative Layout Shift",
        },
        fcp: {
          value: null,
          unit: "ms",
          category: null,
          label: "First Contentful Paint",
        },
        source: "unavailable",
      },
    });
  }
}
