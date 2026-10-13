// ============================================================================
// scrobble-label.ts: WHAT HAPPENED TO A PLAY THAT WAS MEANT FOR LAST.FM
// ============================================================================

import type { ScrobbleState } from '@vinyl/shared';

const LABELS: Record<ScrobbleState, string> = {
  sent: 'Scrobbled',
  pending: 'Scrobbles when it ends',
  skipped: 'Not scrobbled',
  failed: 'Scrobbling failed',
};

export function scrobbleLabel(state: ScrobbleState): string {
  return LABELS[state];
}
