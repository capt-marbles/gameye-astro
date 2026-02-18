import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Gameye Team'),
    category: z.string().default('Infrastructure'),
    tags: z.array(z.string()).default([]),
    coverImage: z.string().url().optional(),
    coverImageAlt: z.string().optional(),
    legacyUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = {
  blog,
};
