// ============================================================================
// scrobbling.ts: SENDING VINYL PLAYS TO LAST.FM
//
// "Scrobbling" is Last.fm's word for adding a played song to your listening
// history. Streaming apps do it automatically; this lets records count too.
//
//   SCROBBLE_STATES         what can happen to a play that should be scrobbled
//   scrobblingStatusSchema  is scrobbling available, and is this account connected?
// ============================================================================

import { z } from 'zod';

/**
 * pending = will be sent once the play is over (Last.fm only takes plays that
 *           have happened)
 * sent    = Last.fm accepted it
 * skipped = nothing to send that Last.fm would accept (no tracklist, or the
 *           play was more than two weeks ago)
 * failed  = Last.fm refused (for example, the connection was removed there)
 */
export const SCROBBLE_STATES = ['pending', 'sent', 'skipped', 'failed'] as const;
export type ScrobbleState = (typeof SCROBBLE_STATES)[number];

export const scrobblingStatusSchema = z.object({
  /** False when the server has no Last.fm shared secret, or for the demo account. */
  available: z.boolean(),
  /**
   * Why it isn't available (null when it is): the server is missing its Last.fm
   * shared secret, or this is the shared demo account.
   */
  unavailableReason: z.enum(['not-set-up', 'demo-account']).nullable(),
  connected: z.boolean(),
  /** The connected Last.fm username (null when not connected). */
  username: z.string().nullable(),
});

export type ScrobblingStatus = z.infer<typeof scrobblingStatusSchema>;
