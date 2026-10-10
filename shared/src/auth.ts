// ============================================================================
// auth.ts: WHAT SIGNING UP AND LOGGING IN LOOK LIKE
//
//   signupInputSchema   a new account: username, password, display name
//   loginInputSchema    logging in: username and password
//   userSchema          an account as the server shows it (never the password)
//   meResponseSchema    "who am I?": the logged-in user, or null
//
// Usernames are stored in lowercase and will be part of addresses later
// (public profiles, like /u/daniel), so they're limited to letters, numbers and _.
// ============================================================================

import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Usernames are 3 to 30 characters')
  .max(30, 'Usernames are 3 to 30 characters')
  .regex(/^[a-z0-9_]+$/, 'Use only letters, numbers and _');

export const PASSWORD_MIN_LENGTH = 8;

export const signupInputSchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(200, 'Keep the password under 200 characters'),
  /** The name shown on screen. Defaults to the username. */
  displayName: z
    .string()
    .trim()
    .max(60, 'Keep the name under 60 characters')
    .nullish()
    .transform((value) => value || null),
});

export type SignupInput = z.input<typeof signupInputSchema>;

export const loginInputSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

export type LoginInput = z.input<typeof loginInputSchema>;

export const userSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const meResponseSchema = z.object({ user: userSchema.nullable() });
export type MeResponse = z.infer<typeof meResponseSchema>;
