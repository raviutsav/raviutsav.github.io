import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkReadingTime } from './src/utils/remark-reading-time.mjs';
import { remarkMathCompat } from './src/utils/remark-math-compat.mjs';

// https://astro.build/config
export default defineConfig({
  // Configure site for canonical URLs, sitemaps, and RSS feeds
  // Set SITE_URL in .env or CI environment when deploying
  site: process.env.SITE_URL || 'https://raviutsav.github.io',
  base: process.env.BASE_PATH || '/',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkReadingTime, remarkMathCompat, remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },
  },
});
