import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { listWordPressCategories, createWordPressCategory } from "@/server/services/wordpress-sync";

export const dynamic = "force-dynamic";

/** Blog categories on the connected site, for the generator's category picker. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const website = await getDefaultWebsite(searchParams.get("website") ?? undefined);
  if (!website) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Website not found" } }, { status: 404 });
  }

  try {
    const categories = await listWordPressCategories(website.id);
    return NextResponse.json({ data: { categories } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CMS_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Could not read categories from the connected site.",
        },
      },
      { status: 400 },
    );
  }
}

/** Creates a new blog category on the connected site. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { websiteId?: string; name?: string };
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "A category name is required" } },
      { status: 400 },
    );
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Website not found" } }, { status: 404 });
  }

  try {
    const category = await createWordPressCategory(website.id, name);
    return NextResponse.json({ data: { category }, message: `Category "${category.name}" is ready.` });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CMS_ERROR",
          message: error instanceof Error ? error.message : "Could not create the category.",
        },
      },
      { status: 400 },
    );
  }
}
