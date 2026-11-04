import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(), cardTitle: z.string(), description: z.string(),
    order: z.number(), year: z.string(), category: z.string(),
    tags: z.array(z.string()), image: z.string(), imageAlt: z.string(),
    status: z.string(), statusChecked: z.string().optional(),
    heroTitle: z.string(), role: z.string(),
    sections: z.array(z.object({ id: z.string(), title: z.string(), paragraphs: z.array(z.string()) })),
    resources: z.array(z.object({ title: z.string(), url: z.url() })),
  }),
});
export const collections = { research };
