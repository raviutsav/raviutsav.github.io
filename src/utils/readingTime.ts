import readingTime from 'reading-time';

export function calculateReadingTime(content: string | undefined): string {
  if (!content) return '1 min read';
  const stats = readingTime(content);
  return stats.text;
}
