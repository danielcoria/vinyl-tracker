// ============================================================================
// format.test.ts: TESTS FOR TURNING RECORD DATA INTO TEXT
// ============================================================================

import { describe, expect, it } from 'vitest';
import { formatArtists, formatDuration, parseDuration } from './format';

describe('formatArtists', () => {
  const artists = (...names: string[]) => names.map((name, id) => ({ id, name }));

  it('joins names naturally', () => {
    expect(formatArtists(artists('Nico'))).toBe('Nico');
    expect(formatArtists(artists('Simon', 'Garfunkel'))).toBe('Simon & Garfunkel');
    expect(formatArtists(artists('Crosby', 'Stills', 'Nash'))).toBe('Crosby, Stills & Nash');
  });

  it('handles a record with no artists', () => {
    expect(formatArtists([])).toBe('Unknown artist');
  });
});

describe('formatDuration', () => {
  it('shows minutes and seconds', () => {
    expect(formatDuration(2569)).toBe('42:49');
    expect(formatDuration(65)).toBe('1:05');
  });

  it('adds hours for long records', () => {
    expect(formatDuration(5637)).toBe('1:33:57');
  });
});

describe('parseDuration', () => {
  it('reads m:ss and h:mm:ss', () => {
    expect(parseDuration('42:49')).toBe(2569);
    expect(parseDuration('1:33:57')).toBe(5637);
    expect(parseDuration(' 3:05 ')).toBe(185);
  });

  it('treats a single number as minutes', () => {
    expect(parseDuration('40')).toBe(2400);
  });

  it('round-trips with formatDuration', () => {
    for (const seconds of [59, 600, 2569, 5637]) {
      expect(parseDuration(formatDuration(seconds))).toBe(seconds);
    }
  });

  it('rejects text that is not a length', () => {
    for (const text of ['', 'abc', '42:', '42:75', '1:2:3:4', '-5', '4.5']) {
      expect(parseDuration(text)).toBeNull();
    }
  });
});
