import type { APIRoute } from 'astro';
import { siteConfig } from '../config/site';
import { resolvePath } from '../utils/url';

export const GET: APIRoute = ({ site }) => {
  const siteOrigin = site ?? new URL(siteConfig.url);
  const sitemapURL = new URL(resolvePath('/sitemap-index.xml'), siteOrigin).toString();

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapURL}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};

