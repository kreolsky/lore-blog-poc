import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { existsSync, readFileSync } from 'node:fs';
import { loreLoader } from './lore-loader.ts';

function env(name: string): string {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  if (existsSync('.env')) {
    const m = readFileSync('.env', 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (m) return m[1].trim();
  }
  throw new Error(`${name} is not set — copy .env.example to .env and fill it in`);
}

const lore = defineCollection({
  loader: loreLoader({ url: env('LORE_URL'), root: env('LORE_ROOT') }),
  schema: z.object({
    title: z.string(),
    category: z.string().nullable(),
    categoryOrder: z.string().nullable(),
    order: z.string(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    date: z.string().optional(),
    updated: z.string().optional(),
    headings: z.array(
      z.object({
        depth: z.number(),
        slug: z.string().optional(),
        text: z.string(),
      }),
    ),
  }),
});

export const collections = { lore };
