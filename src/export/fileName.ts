import type { Engagement } from '../domain/types';

/**
 * Deliverable file name. Kept in its own module so screens can display it
 * without pulling in the XLSX writer, which is lazy-loaded on export.
 */
export function buildFileName(engagement: Engagement, extension = 'xlsx'): string {
  const slug =
    engagement.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'engagement';
  return `vapt-${slug}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
