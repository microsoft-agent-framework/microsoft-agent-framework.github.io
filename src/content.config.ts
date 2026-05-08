import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const tutorials = defineCollection({
  loader: glob({ pattern: ['**/*.md', '**/*.mdx', '!**/README.md'], base: './src/content/tutorials' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    series: z.string(),
    seriesOrder: z.number(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
    time: z.string(),
    samplePath: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    concepts: z.array(z.string()).default([]),
    provider: z.string(),
    hosting: z.string(),
    prerequisites: z.array(z.string()).default([]),
    envVars: z.array(z.string()).default([]),
    runCommands: z.array(z.string()).default([]),
    expectedOutput: z.array(z.string()).default([]),
    troubleshooting: z.array(z.string()).default([]),
    next: z.string().optional()
  })
});

export const collections = { tutorials };
