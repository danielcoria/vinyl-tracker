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
  // Optional until the Discogs integration lands (M4); that code checks for it.
  DISCOGS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  DISCOGS_USER_AGENT: z.string().default('VinylTracker/0.1'),
});

export type Config = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  /** Absolute path, or ':memory:'. A relative DATABASE_PATH resolves from the repo root. */
  databasePath: string;
  discogs: { token: string | undefined; userAgent: string };
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
    discogs: { token: e.DISCOGS_TOKEN, userAgent: e.DISCOGS_USER_AGENT },
  };
}
