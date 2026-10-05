import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Repo-root .env. Resolves the same from src/ (dev) and dist/ (build).
const ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url));

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
    databasePath: e.DATABASE_PATH,
    discogs: { token: e.DISCOGS_TOKEN, userAgent: e.DISCOGS_USER_AGENT },
  };
}
