// ============================================================================
// settings.ts (service): READ AND CHANGE SETTINGS
//
// Each setting is one row in the `settings` table. Anything not saved yet uses
// its default (DEFAULT_SETTINGS in shared/), so a brand-new database just works.
// ============================================================================

import {
  DEFAULT_SETTINGS,
  settingsSchema,
  type Settings,
  type SettingsUpdate,
} from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { settings } from '../db/schema.js';

export function getSettings(db: Db): Settings {
  const saved: Record<string, unknown> = {};
  for (const row of db.select().from(settings).all()) {
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

export function updateSettings(db: Db, update: SettingsUpdate): Settings {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) continue;
      tx.insert(settings)
        .values({ key, value: JSON.stringify(value) })
        // Insert, or replace the value if the setting already exists.
        .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value) } })
        .run();
    }
  });
  return getSettings(db);
}
