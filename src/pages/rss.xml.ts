import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { siteConfig } from '../config/site';
import { resolvePath } from '../utils/url';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  const sortedPosts = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  const site = context.site ?? new URL(siteConfig.url);

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site,
    items: sortedPosts.map((post) => {
      const postPath = resolvePath(`/writing/${post.id}/`);
      const link = new URL(postPath, site).toString();

      return {
        title: post.data.title || post.id,
        pubDate: post.data.pubDate,
        description: post.data.description ?? '',
        link,
        ...(post.data.tags && post.data.tags.length > 0
          ? { categories: post.data.tags }
          : {}),
      };
    }),
    customData: '<language>en-us</language>',
  });
}

