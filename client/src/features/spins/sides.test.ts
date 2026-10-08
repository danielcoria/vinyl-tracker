// ============================================================================
// sides.test.ts: TESTS FOR WORKING WITH SIDES
// ============================================================================

import { describe, expect, it } from 'vitest';
import { KIND_OF_BLUE_TRACKS } from '../../test/fake-api';
import { formatSides, groupBySide, playLength, sideLetters } from './sides';

describe('groupBySide', () => {
  it('groups tracks by side with each side’s length', () => {
    const groups = groupBySide(KIND_OF_BLUE_TRACKS);

    expect(groups.map((g) => [g.side, g.tracks.length, g.durationSeconds])).toEqual([
      ['A', 3, 1435], // 23:55
      ['B', 2, 1266], // 21:06
    ]);
  });

  it("gives no side length when a track's length is unknown", () => {
    const tracks = KIND_OF_BLUE_TRACKS.slice(0, 1).map((t) => ({ ...t, durationSeconds: null }));
    expect(groupBySide(tracks)[0]?.durationSeconds).toBeNull();
  });
});

describe('formatSides', () => {
  it('describes which sides were played', () => {
    expect(formatSides(null)).toBe('Whole record');
    expect(formatSides(['A'])).toBe('Side A');
    expect(formatSides(['A', 'C'])).toBe('Sides A & C');
    expect(formatSides(['A', 'B', 'D'])).toBe('Sides A, B & D');
  });
});

describe('playLength', () => {
  it('adds up the chosen sides', () => {
    expect(playLength(KIND_OF_BLUE_TRACKS, ['A'], null)).toBe(1435);
    expect(playLength(KIND_OF_BLUE_TRACKS, ['A', 'B'], null)).toBe(2701);
  });

  it('uses the album length for a full play when track lengths are missing', () => {
    const untimed = KIND_OF_BLUE_TRACKS.map((t) => ({ ...t, durationSeconds: null }));
    expect(playLength(untimed, ['A', 'B'], 2744)).toBe(2744);
    expect(playLength(untimed, ['A'], 2744)).toBeNull();
  });

  it('uses the album length for records without a tracklist', () => {
    expect(sideLetters([])).toEqual([]);
    expect(playLength([], [], 2744)).toBe(2744);
    expect(playLength([], [], null)).toBeNull();
  });
});
