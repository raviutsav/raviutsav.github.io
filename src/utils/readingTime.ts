import { render, type CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';

export function calculateReadingTime(content: string | undefined): string {
  if (!content) return '1 min read';
  const stats = readingTime(content);
  return stats.text;
}

export async function getPostReadingTime(post: CollectionEntry<'blog'>): Promise<string> {
  const { remarkPluginFrontmatter } = await render(post);
  return remarkPluginFrontmatter?.readingTime || calculateReadingTime(post.body);
}
