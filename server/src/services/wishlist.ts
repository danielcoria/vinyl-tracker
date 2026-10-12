// ============================================================================
// wishlist.ts (service): ALBUMS TO BUY ONE DAY
//
// List, add and remove. Adding an album that's already on the wishlist just
// returns the one that's there (ignoring capital letters), so clicking "Add"
// twice never makes a duplicate. As everywhere, each person only sees and
// changes their own list.
// ============================================================================

import { and, desc, eq, sql } from 'drizzle-orm';
import type { ParsedWishlistInput, WishlistItem } from '@vinyl/shared';
import type { Db } from '../db/client.js';
import { wishlistItems } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

type Row = typeof wishlistItems.$inferSelect;

const toItem = ({ id, title, artist, coverImageUrl, playCount, addedAt }: Row): WishlistItem => ({
  id,
  title,
  artist,
  coverImageUrl,
  playCount,
  addedAt,
});

/** Newest first. */
export function listWishlist(db: Db, userId: number): WishlistItem[] {
  return db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.addedAt), desc(wishlistItems.id))
    .all()
    .map(toItem);
}

/** Returns the item and whether it was newly added. */
export function addToWishlist(
  db: Db,
  userId: number,
  input: ParsedWishlistInput,
): { item: WishlistItem; created: boolean } {
  const existing = db
    .select()
    .from(wishlistItems)
    .where(
      and(
        eq(wishlistItems.userId, userId),
        sql`lower(${wishlistItems.artist}) = lower(${input.artist})`,
        sql`lower(${wishlistItems.title}) = lower(${input.title})`,
      ),
    )
    .get();
  if (existing) return { item: toItem(existing), created: false };

  const row = db
    .insert(wishlistItems)
    .values({ userId, ...input })
    .returning()
    .get();
  return { item: toItem(row), created: true };
}

export function removeFromWishlist(db: Db, userId: number, id: number): void {
  const deleted = db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, userId)))
    .returning({ id: wishlistItems.id })
    .get();
  if (!deleted) throw new NotFoundError(`Wishlist item ${id} not found`);
}
