import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';

// Same env() contract as src/content.config.ts: process env first, then .env,
// crash with a clear message when unset. `site` MUST be absolute — RSS needs
// absolute URLs for every <link>.
function env(name) {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  if (existsSync('.env')) {
    const m = readFileSync('.env', 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (m) return m[1].trim();
  }
  throw new Error(`${name} is not set — copy .env.example to .env and fill it in`);
}

export default defineConfig({
  site: env('SITE_URL'),
});
