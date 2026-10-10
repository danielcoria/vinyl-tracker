// ============================================================================
// styluses.ts (service): THE STYLUS WEAR TRACKER
//
//   listStyluses    every stylus, newest first, with its wear
//   addStylus       install a new stylus (the current one is retired at the
//                   moment the new one goes in)
//   updateStylus    fix its name, rated hours or starting hours
//   deleteStylus    remove one added by mistake. Deleting the one in use puts
//                   the previous stylus back in use, like an "undo".
//
// Wear = starting hours + every play logged between the stylus's install time
// and its retire time (or now). Plays logged later with a past date still count
// for the stylus that was installed then.
// ============================================================================

import { and, count, desc, eq, gte, inArray, isNull, lt, sum, type SQL } from 'drizzle-orm';
import {
  STYLUS_SOON_AT,
  type ParsedStylusInput,
  type Stylus,
  type StylusStatus,
  type ParsedStylusUpdate,
} from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { records, spins, styluses } from '../db/schema.js';
import { AppError, NotFoundError } from '../errors.js';

type StylusRow = typeof styluses.$inferSelect;

/** "This stylus, and it belongs to this person." */
const ownStylus = (userId: number, id: number) =>
  and(eq(styluses.id, id), eq(styluses.userId, userId));

export function listStyluses(db: Db, userId: number): Stylus[] {
  const rows = db
    .select()
    .from(styluses)
    .where(eq(styluses.userId, userId))
    .orderBy(desc(styluses.installedAt), desc(styluses.id))
    .all();
  return rows.map((row) => withWear(db, userId, row));
}

export function getStylus(db: Db, userId: number, id: number): Stylus {
  const row = db.select().from(styluses).where(ownStylus(userId, id)).get();
  if (!row) throw new NotFoundError(`Stylus ${id} not found`);
  return withWear(db, userId, row);
}

export function addStylus(db: Db, userId: number, input: ParsedStylusInput): Stylus {
  const installedAt = new Date(input.installedAt).toISOString();

  const id = db.transaction((tx) => {
    const current = tx
      .select()
      .from(styluses)
      .where(and(eq(styluses.userId, userId), isNull(styluses.retiredAt)))
      .get();
    if (current) {
      if (installedAt <= current.installedAt) {
        throw new AppError(
          400,
          'INSTALLED_BEFORE_CURRENT',
          `The new stylus must be installed after the current one (${current.name}, installed ${current.installedAt.slice(0, 10)})`,
        );
      }
      // The old stylus stops counting the moment the new one goes in.
      tx.update(styluses).set({ retiredAt: installedAt }).where(eq(styluses.id, current.id)).run();
    }
    return tx
      .insert(styluses)
      .values({
        userId,
        name: input.name,
        ratedHours: input.ratedHours,
        initialHours: input.initialHours,
        installedAt,
      })
      .returning({ id: styluses.id })
      .get().id;
  });
  return getStylus(db, userId, id);
}

export function updateStylus(
  db: Db,
  userId: number,
  id: number,
  update: ParsedStylusUpdate,
): Stylus {
  const updated = db
    .update(styluses)
    .set({ name: update.name, ratedHours: update.ratedHours, initialHours: update.initialHours })
    .where(ownStylus(userId, id))
    .returning({ id: styluses.id })
    .get();
  if (!updated) throw new NotFoundError(`Stylus ${id} not found`);
  return getStylus(db, userId, id);
}

export function deleteStylus(db: Db, userId: number, id: number): void {
  db.transaction((tx) => {
    const row = tx.select().from(styluses).where(ownStylus(userId, id)).get();
    if (!row) throw new NotFoundError(`Stylus ${id} not found`);
    tx.delete(styluses).where(eq(styluses.id, id)).run();

    // Deleting the one in use: the stylus it replaced goes back in use.
    if (row.retiredAt === null) {
      tx.update(styluses)
        .set({ retiredAt: null })
        .where(and(eq(styluses.userId, userId), eq(styluses.retiredAt, row.installedAt)))
        .run();
    }
  });
}

/** Adds up the plays logged while this stylus was installed. */
function withWear(db: Db, userId: number, row: StylusRow): Stylus {
  // This person's plays (of records they own) while this stylus was installed.
  const ownRecords = db.select({ id: records.id }).from(records).where(eq(records.userId, userId));
  const during: SQL[] = [inArray(spins.recordId, ownRecords), gte(spins.playedAt, row.installedAt)];
  if (row.retiredAt) during.push(lt(spins.playedAt, row.retiredAt));

  const totals = db
    .select({ seconds: sum(spins.durationSeconds), plays: count() })
    .from(spins)
    .where(and(...during))
    .get();
  const playedSeconds = Number(totals?.seconds ?? 0);
  const spinCount = totals?.plays ?? 0;

  const hoursUsed = row.initialHours + playedSeconds / 3600;
  const share = hoursUsed / row.ratedHours;

  return {
    ...row,
    hoursUsed: Math.round(hoursUsed * 10) / 10,
    spinCount,
    percentUsed: Math.round(share * 100),
    status: statusFor(share),
    averageSpinSeconds: spinCount > 0 ? Math.round(playedSeconds / spinCount) : null,
  };
}

export function statusFor(share: number): StylusStatus {
  if (share >= 1) return 'replace';
  if (share >= STYLUS_SOON_AT) return 'soon';
  return 'ok';
}
