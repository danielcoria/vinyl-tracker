// ============================================================================
// styluses.ts: WHAT A STYLUS (TURNTABLE NEEDLE) LOOKS LIKE
//
//   stylusInputSchema   what the website sends to add a stylus
//   stylusUpdateSchema  what can be changed later (name, rating, starting hours)
//   stylusSchema        a stylus as the server sends it back, with its wear
//                       worked out from the listening diary
//
// Wear status: "ok" under 75% of the rated hours, "soon" from 75%,
// "replace" at 100% or more.
// ============================================================================

import { z } from 'zod';

export const STYLUS_STATUSES = ['ok', 'soon', 'replace'] as const;
export type StylusStatus = (typeof STYLUS_STATUSES)[number];

/** At this share of the rated hours, start suggesting a replacement. */
export const STYLUS_SOON_AT = 0.75;

const stylusFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Give the stylus a name, like its model')
    .max(100, 'Keep the name under 100 characters'),
  ratedHours: z
    .number({ error: 'Enter the rated hours' })
    .int('Use a whole number of hours')
    .min(50, 'Rated hours must be at least 50')
    .max(10000, 'Rated hours must be at most 10,000'),
  initialHours: z
    .number({ error: 'Enter a number of hours' })
    .int('Use a whole number of hours')
    .min(0, "Hours can't be negative")
    .max(10000, 'Hours must be at most 10,000')
    .default(0),
};

export const stylusInputSchema = z.object({
  ...stylusFields,
  /** When it was installed. Defaults to now. */
  installedAt: z.iso
    .datetime({ error: 'Pick a valid date' })
    .refine((value) => Date.parse(value) <= Date.now() + 5 * 60 * 1000, {
      error: "The install date can't be in the future",
    })
    .default(() => new Date().toISOString()),
});

export type StylusInput = z.input<typeof stylusInputSchema>;
export type ParsedStylusInput = z.output<typeof stylusInputSchema>;

export const stylusUpdateSchema = z.object(stylusFields);
export type StylusUpdate = z.input<typeof stylusUpdateSchema>;
export type ParsedStylusUpdate = z.output<typeof stylusUpdateSchema>;

export const stylusSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  ratedHours: z.number().int(),
  initialHours: z.number().int(),
  installedAt: z.string(),
  /** null = the stylus in use now. */
  retiredAt: z.string().nullable(),
  /** Starting hours plus every logged play while it was installed (1 decimal). */
  hoursUsed: z.number(),
  spinCount: z.number().int(),
  /** hoursUsed / ratedHours, as a whole percentage (can go over 100). */
  percentUsed: z.number().int(),
  status: z.enum(STYLUS_STATUSES),
  /** Average length of a play on this stylus, for "about N more plays" (null if no plays). */
  averageSpinSeconds: z.number().int().nullable(),
});

export type Stylus = z.infer<typeof stylusSchema>;

/** Newest first; the active stylus (if any) is first. */
export const stylusListSchema = z.object({ styluses: z.array(stylusSchema) });
export type StylusList = z.infer<typeof stylusListSchema>;
