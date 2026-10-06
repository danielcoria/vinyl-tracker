// ============================================================================
// errors.ts: THE SHAPE OF EVERY ERROR THE SERVER SENDS
//
// Whenever something goes wrong, the server answers in this same format:
//   { "error": { "code": "NOT_FOUND", "message": "Record 5 not found" } }
// One format everywhere means the website only needs one way to show errors.
// ============================================================================

import { z } from 'zod';

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
