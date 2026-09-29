import { redirect } from "next/navigation";

export default async function ContentWriterRedirectPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, val]) => {
    if (typeof val === "string") {
      params.set(key, val);
    } else if (Array.isArray(val) && val[0]) {
      params.set(key, val[0]);
    }
  });

  const queryStr = params.toString();
  redirect(`/content/generator${queryStr ? `?${queryStr}` : ""}`);
}
