// ============================================================================
// health.ts: THE SHAPE OF THE "ARE YOU ALIVE?" ANSWER
//
// Zod is a library for describing the shape of data, called a "schema".
// A schema can CHECK data (is this really a number?) and also gives
// TypeScript a matching type for free (that is what z.infer does).
// ============================================================================

import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
