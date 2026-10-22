/**
 * Utility to resolve relative URLs with the configured Astro base path.
 * Ensures compatibility with GitHub Pages (e.g., /personalpage/) and custom domains (/).
 */
export function resolvePath(path: string): string {
  if (!path) return '/';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('mailto:')) {
    return path;
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) return cleanPath;
  return `${base}${cleanPath}`;
}
