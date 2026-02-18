import type { CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;

export const sortBlogPosts = (entries: BlogEntry[]) =>
  [...entries].sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime());

export const estimateReadingMinutes = (content: string, wordsPerMinute = 220) => {
  const clean = content
    .replace(/```[\\s\\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\\*_#>[\\]()-]/g, ' ');

  const words = clean
    .split(/\\s+/)
    .map((token) => token.trim())
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

export const formatBlogDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
