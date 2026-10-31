/**
 * Slug + URL helpers for project pages.
 *
 * URL format: `/projects/<id>-<slug>` — e.g. `/projects/12-du-an-khmer`.
 * The leading numeric portion is the canonical ID; the slug is purely
 * cosmetic and can be omitted (`/projects/12` still resolves correctly via
 * `parseInt`, which stops at the first non-digit).
 */

// Combining diacritical marks block (U+0300..U+036F)
const DIACRITICS_RE = /[̀-ͯ]/g;

export function slugify(input: string, maxLen = 60): string {
  if (!input) return "";
  const stripped = input
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  const slug = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLen).replace(/-+$/g, "");
}

export function projectPath(p: { id: number; name?: string | null }, sub?: string): string {
  const slug = slugify(p.name ?? "");
  const seg = slug ? `${p.id}-${slug}` : String(p.id);
  return sub ? `/projects/${seg}/${sub}` : `/projects/${seg}`;
}

export function parseProjectId(raw: string | undefined): number {
  if (!raw) return NaN;
  return parseInt(raw, 10);
}
