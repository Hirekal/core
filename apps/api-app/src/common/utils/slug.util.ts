/**
 * Slugify a title: lowercase, non-alphanumeric to hyphens, collapse/trim.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Resolve a globally unique slug by appending -2, -3, … on collision.
 */
export async function resolveUniqueSlug(
  baseSlug: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = baseSlug || 'job';
  let suffix = 2;

  while (await isTaken(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
