import { customAlphabet } from 'nanoid';

const SLUG_MAX_LENGTH = 64;

/** Lowercase slug: non-alphanumeric → hyphens, collapsed/trimmed. */
export function slugify(value: string, maxLength = SLUG_MAX_LENGTH): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!slug) {
    return 'event';
  }

  return slug.slice(0, maxLength).replace(/-+$/g, '') || 'event';
}

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const nanoidAlphanumeric = customAlphabet(ALPHANUM);

export function randomAlphanumeric(length: number): string {
  return nanoidAlphanumeric(length);
}
