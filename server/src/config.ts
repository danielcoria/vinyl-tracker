// ============================================================================
// config.ts: READS THE SETTINGS (from the .env file)
//
// Settings like the port number, where the database file lives, and the
// secret Discogs token come from the .env file at the top of the project.
// This is the ONLY file allowed to read them. It checks they are valid and
// hands them to the rest of the app as a tidy "config" object.
// Secret values are never printed, even when something is wrong.
// ============================================================================

import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { REPO_ROOT } from './paths.js';

const ENV_FILE = path.join(REPO_ROOT, '.env');

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_PATH: z.string().default('./data/vinyl.db'),
  // Without a token, the Discogs features say "not set up" instead of working.
  DISCOGS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  DISCOGS_USER_AGENT: z.string().default('VinylTracker/0.1'),
  // Only changed by the end-to-end tests, which point it at a fake Discogs.
  DISCOGS_API_URL: z.url().default('https://api.discogs.com'),
  // When set, the whole site asks for this password (until accounts arrive in M11).
  APP_PASSWORD: z.preprocess(
    emptyToUndefined,
    z.string().min(8, 'APP_PASSWORD must be at least 8 characters').optional(),
  ),
  // "true" when running behind a host's proxy, so each visitor's real address is
  // seen (the password lock slows down wrong guesses per address).
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  /** Absolute path, or ':memory:'. A relative DATABASE_PATH resolves from the repo root. */
  databasePath: string;
  discogs: { token: string | undefined; userAgent: string; apiUrl: string };
  /** The site-wide password, or undefined for no lock (local development). */
  appPassword: string | undefined;
  trustProxy: boolean;
};

/** The only place that reads process.env. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env && existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Report variable names only, never values (they may be secrets).
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databasePath:
      e.DATABASE_PATH === ':memory:' ? e.DATABASE_PATH : path.resolve(REPO_ROOT, e.DATABASE_PATH),
    discogs: { token: e.DISCOGS_TOKEN, userAgent: e.DISCOGS_USER_AGENT, apiUrl: e.DISCOGS_API_URL },
    appPassword: e.APP_PASSWORD,
    trustProxy: e.TRUST_PROXY === 'true',
  };
}
