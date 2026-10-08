// ============================================================================
// StatTiles.tsx: THE ROW OF BIG NUMBERS AT THE TOP OF THE STATS PAGE
//
//   [ 24 plays ] [ 18.5 h listened ] [ 12 records ] [ 15 artists ]
// ============================================================================

import type { Stats } from '@vinyl/shared';
import { formatHours } from './format';

export function StatTiles({ totals }: { totals: Stats['totals'] }) {
  const tiles = [
    { label: 'Plays', value: totals.spinCount.toLocaleString() },
    { label: 'Listening time', value: formatHours(totals.listeningSeconds) },
    { label: 'Records played', value: totals.recordCount.toLocaleString() },
    { label: 'Artists', value: totals.artistCount.toLocaleString() },
  ];

  return (
    <dl className="stat-tiles">
      {tiles.map((tile) => (
        <div key={tile.label} className="stat-tile">
          <dt>{tile.label}</dt>
          <dd>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
