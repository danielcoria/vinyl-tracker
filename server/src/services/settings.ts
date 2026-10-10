// ============================================================================
// settings.ts (service): READ AND CHANGE A PERSON'S SETTINGS
//
// Each setting is one row in the `user_settings` table, per person. Anything
// not saved yet uses its default (DEFAULT_SETTINGS in shared/), so a brand-new
// account just works.
// ============================================================================

import { eq } from 'drizzle-orm';
import {
  DEFAULT_SETTINGS,
  settingsSchema,
  type Settings,
  type SettingsUpdate,
} from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { userSettings } from '../db/schema.js';

export function getSettings(db: Db, userId: number): Settings {
  const saved: Record<string, unknown> = {};
  for (const row of db.select().from(userSettings).where(eq(userSettings.userId, userId)).all()) {
    try {
      saved[row.key] = JSON.parse(row.value);
    } catch {
      // A broken value is ignored, so its default is used instead.
    }
  }
  // Check each saved value; an invalid one also falls back to its default.
  const result: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const parsed = settingsSchema.shape[key].safeParse(saved[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result;
}

export function updateSettings(db: Db, userId: number, update: SettingsUpdate): Settings {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) continue;
      tx.insert(userSettings)
        .values({ userId, key, value: JSON.stringify(value) })
        // Insert, or replace the value if the setting already exists.
        .onConflictDoUpdate({
          target: [userSettings.userId, userSettings.key],
          set: { value: JSON.stringify(value) },
        })
        .run();
    }
  });
  return getSettings(db, userId);
}
