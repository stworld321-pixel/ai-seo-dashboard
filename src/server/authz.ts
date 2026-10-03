/**
 * Authorization policy — the single source of truth for "who is an admin".
 *
 * Deliberately dependency-free (no Prisma, no next/headers) so the proxy,
 * server components, and API routes can all import the same rule rather than
 * each re-deriving it. Every previous copy of this logic also accepted a
 * database `isAdmin` flag or a `role === "ADMIN"` claim, which meant a stray
 * row — or a session token minted before a demotion — granted the admin
 * dashboard. Admin is now decided by email address alone.
 */

const DEFAULT_ADMIN_EMAILS = [
  "suriymanikandan4@gmail.com",
  "suriyamanikandan4@gmail.com",
];

/** Admin addresses, from ADMIN_EMAILS (comma-separated) or the built-in default. */
export function adminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";
  const parsed = configured
    .toLowerCase()
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ADMIN_EMAILS;
}

/**
 * The only admin test in the system. A database flag or session claim is NOT
 * accepted: privilege follows the configured address, so it cannot be escalated
 * by editing a user row, and revoking it takes effect immediately rather than
 * when the session expires.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
