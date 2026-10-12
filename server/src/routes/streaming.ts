// ============================================================================
// routes/streaming.ts: THE ADDRESSES FOR STREAMING VS. SHELF AND THE WISHLIST
//
//   GET    /api/streaming?period=12month       most-streamed albums, each marked
//                                              as on the shelf / wishlist / neither
//   GET    /api/streaming/price?artist=&title= what the album costs on vinyl now
//   GET    /api/wishlist                       the wishlist, newest first
//   POST   /api/wishlist                       add an album { title, artist, ... }
//   DELETE /api/wishlist/5                     remove item 5
//
// Streaming needs a Last.fm API key on the server and prices need the Discogs
// token; without them these answer 503 "not set up" instead of failing oddly.
// ============================================================================

import { Router } from 'express';
import {
  priceQuerySchema,
  streamingQuerySchema,
  wishlistInputSchema,
  type Wishlist,
} from '@vinyl/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import type { DiscogsClient } from '../integrations/discogs/client.js';
import type { LastfmSource } from '../integrations/lastfm/client.js';
import { userIdOf } from '../middleware/session.js';
import { getStreaming, getVinylPrice } from '../services/streaming.js';
import { addToWishlist, listWishlist, removeFromWishlist } from '../services/wishlist.js';

export function streamingRouter(
  db: Db,
  lastfm: LastfmSource | null,
  discogs: DiscogsClient | null,
) {
  const router = Router();

  router.get('/', async (req, res) => {
    if (!lastfm) {
      throw new AppError(
        503,
        'LASTFM_NOT_CONFIGURED',
        'Last.fm is not set up. Add LASTFM_API_KEY to the .env file and restart the server.',
      );
    }
    const { period } = streamingQuerySchema.parse(req.query);
    res.json(await getStreaming(db, userIdOf(req), lastfm, period));
  });

  router.get('/price', async (req, res) => {
    userIdOf(req);
    if (!discogs) {
      throw new AppError(
        503,
        'DISCOGS_NOT_CONFIGURED',
        'Discogs is not set up. Add DISCOGS_TOKEN to the .env file and restart the server.',
      );
    }
    res.json(await getVinylPrice(discogs, priceQuerySchema.parse(req.query)));
  });

  return router;
}

const idParam = z.coerce.number().int().positive();

export function wishlistRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    const body: Wishlist = { items: listWishlist(db, userIdOf(req)) };
    res.json(body);
  });

  router.post('/', (req, res) => {
    const input = wishlistInputSchema.parse(req.body);
    const { item, created } = addToWishlist(db, userIdOf(req), input);
    // 201 = newly added; 200 = it was already there.
    res.status(created ? 201 : 200).json(item);
  });

  router.delete('/:id', (req, res) => {
    removeFromWishlist(db, userIdOf(req), idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
