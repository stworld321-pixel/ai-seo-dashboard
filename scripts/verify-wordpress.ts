/**
 * Verifies the stored WordPress credentials and reports exactly what the
 * integration can and cannot do. Run after adding WP_APP_PASSWORD to .env:
 *
 *   npm run verify:wp
 *
 * Prints no secret values — only whether authentication succeeded.
 */
import "dotenv/config";
import { WordPressProvider } from "../src/server/integrations/cms/wordpress";

const SITE = "https://litenatures.in";

async function main() {
  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;

  console.log("WordPress credential check");
  console.log(`  site     : ${SITE}`);
  console.log(`  username : ${username || "(not set)"}`);
  console.log(`  password : ${appPassword ? `set (${appPassword.length} chars)` : "(not set)"}`);

  if (!username || !appPassword) {
    console.log("\nNot configured. Add both to .env, then re-run.");
    console.log("WordPress admin -> Users -> Profile -> Application Passwords");
    process.exit(1);
  }

  const wp = new WordPressProvider({ siteUrl: SITE, username, appPassword });
  const v = await wp.verify();

  if (!v.ok) {
    console.log(`\nAUTH FAILED: ${v.error}`);
    console.log("\nCommon causes:");
    console.log("  - the application password was copied without its spaces");
    console.log("  - the username is wrong (use the WP login name or email)");
    console.log("  - a security plugin is blocking REST authentication");
    process.exit(1);
  }

  console.log(`\nAuthenticated as: ${v.user}`);

  const caps = wp.capabilities();
  console.log("\nCapabilities:");
  console.log(`  read content      : ${caps.canRead}`);
  console.log(`  update SEO meta   : ${caps.canUpdateSeoMeta}`);
  console.log(`  create content    : ${caps.canCreate}   (not implemented yet)`);
  console.log(`  delete content    : never — not implemented by design`);

  // Prove write access is real by reading back a known product.
  const item = await wp.getByUrl(`${SITE}/product/coconutmilk-soap/`);
  if (item) {
    console.log(`\nP1 target resolves: ${item.title} (id ${item.id}, ${item.type})`);
    console.log(`  SEO title  : ${item.seoTitle ?? "EMPTY"}`);
    console.log(`  meta desc  : ${item.metaDescription ?? "EMPTY"}`);
  }

  console.log("\nReady. Writes are still gated behind explicit approval.");
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
