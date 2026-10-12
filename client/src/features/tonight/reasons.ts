// ============================================================================
// reasons.ts: WHY A RECORD WAS SUGGESTED, IN PLAIN WORDS
//
// The server sends facts (last played, rating, which sides fit); this turns
// them into short lines like "Last played 4 months ago".
// ============================================================================

import type { Suggestion } from '@vinyl/shared';
import { formatDuration } from '../collection/format';
import { formatDaysAgo } from '../dust/time-ago';
import { starsLabel } from '../ratings/format';
import { formatSides } from '../spins/sides';

export function reasonsFor(suggestion: Suggestion, minutes: number | null): string[] {
  const reasons: string[] = [];

  reasons.push(
    suggestion.lastPlayedAt === null
      ? 'Never played'
      : `Last played ${formatDaysAgo(suggestion.daysSince)}`,
  );

  if (suggestion.rating !== null) reasons.push(`You gave it ${starsLabel(suggestion.rating)}`);

  if (suggestion.durationSeconds !== null) {
    const length = formatDuration(suggestion.durationSeconds);
    if (minutes === null) reasons.push(`Runs ${length}`);
    else if (suggestion.sides === null) reasons.push(`The whole record fits (${length})`);
    else {
      const verb = suggestion.sides.length === 1 ? 'fits' : 'fit';
      reasons.push(`${formatSides(suggestion.sides)} ${verb} your ${minutes} minutes (${length})`);
    }
  }

  return reasons;
}
