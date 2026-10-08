// ============================================================================
// settings.ts: THE APP'S SETTINGS
//
//   settingsSchema        every setting and its allowed values
//   settingsUpdateSchema  change some settings (any you leave out stay the same)
//   DEFAULT_SETTINGS      what each setting is until you change it
// ============================================================================

import { z } from 'zod';

export const settingsSchema = z.object({
  /** A record "gathers dust" when it hasn't been played in this many days. */
  dustThresholdDays: z
    .number()
    .int()
    .min(7, 'Pick at least 7 days')
    .max(3650, 'Pick at most 10 years'),
});

export type Settings = z.infer<typeof settingsSchema>;

export const settingsUpdateSchema = settingsSchema.partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const DEFAULT_SETTINGS: Settings = {
  dustThresholdDays: 90,
};
