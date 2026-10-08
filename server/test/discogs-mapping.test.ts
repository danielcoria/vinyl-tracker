// ============================================================================
// discogs-mapping.test.ts: TESTS FOR CONVERTING DISCOGS DATA
//
// Uses a real recorded Discogs answer (Kind of Blue, 2010 French reissue)
// plus small hand-made examples for the unusual cases.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  cleanName,
  parseTrackDuration,
  releaseToRecordInput,
  releaseToTracks,
  sideOf,
  toSearchResult,
  totalRuntime,
} from '../src/integrations/discogs/mapping.js';
import { rawReleaseSchema, rawSearchSchema } from '../src/integrations/discogs/schemas.js';
import { fixture } from './discogs-helpers.js';

const release = rawReleaseSchema.parse(fixture('release-2772432.json'));
const search = rawSearchSchema.parse(fixture('search-kind-of-blue.json'));

describe('releaseToRecordInput', () => {
  it('turns a real Discogs release into a record', () => {
    expect(releaseToRecordInput(release)).toEqual({
      title: 'Kind Of Blue',
      artists: ['Miles Davis'],
      year: 2010,
      label: 'Columbia',
      catalogNumber: 'CS 8163',
      format: 'LP',
      coverImageUrl: expect.stringMatching(/^https:\/\/i\.discogs\.com\//),
      // 8:56 + 9:32 + 5:27 + 11:34 + 9:32
      runtimeSeconds: 2701,
      genres: ['Jazz'],
      styles: ['Modal'],
    });
  });

  it('handles double albums, numbered artists and missing details', () => {
    const input = releaseToRecordInput(
      rawReleaseSchema.parse({
        id: 1,
        title: 'Live',
        year: 0,
        artists: [
          { id: 1, name: 'Nirvana (2)' },
          { id: 2, name: 'Guest*' },
        ],
        labels: [{ name: 'Some Label (3)', catno: 'none' }],
        formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP', 'Album'] }],
        images: [],
        tracklist: [{ type_: 'track', title: 'Untimed', duration: '' }],
      }),
    );

    expect(input).toMatchObject({
      artists: ['Nirvana', 'Guest'],
      year: null, // Discogs uses 0 for "unknown"
      label: 'Some Label',
      catalogNumber: null, // "none" means no catalog number
      format: '2xLP',
      coverImageUrl: null,
      runtimeSeconds: null,
      genres: [],
    });
  });

  it('prefers the size for singles, like 7"', () => {
    const input = releaseToRecordInput(
      rawReleaseSchema.parse({
        id: 2,
        title: 'Single',
        formats: [{ name: 'Vinyl', qty: '1', descriptions: ['Single', '7"', '45 RPM'] }],
      }),
    );
    expect(input.format).toBe('7"');
  });
});

describe('toSearchResult', () => {
  it('splits "Artist - Title" and picks the format', () => {
    const first = search.results[0];
    if (!first) throw new Error('fixture has no results');

    expect(toSearchResult(first)).toEqual({
      releaseId: 2772432,
      artist: 'Miles Davis',
      title: 'Kind Of Blue',
      year: 2010,
      format: 'LP',
      label: 'Columbia',
      catalogNumber: 'CS 8163',
      country: 'France',
      thumbUrl: expect.stringMatching(/^https:\/\/i\.discogs\.com\//),
    });
  });

  it("ignores Discogs' placeholder image and keeps commas in artist names", () => {
    const result = toSearchResult({
      id: 9,
      title: 'Crosby, Stills, Nash & Young (2) - Déjà Vu',
      thumb: 'https://st.discogs.com/images/spacer.gif',
      cover_image: 'https://st.discogs.com/images/spacer.gif',
    });
    expect(result).toMatchObject({
      artist: 'Crosby, Stills, Nash & Young',
      title: 'Déjà Vu',
      thumbUrl: null,
      year: null,
      format: null,
    });
  });
});

describe('cleanName', () => {
  it('removes Discogs numbering and name-variation stars', () => {
    expect(cleanName('Nirvana (2)')).toBe('Nirvana');
    expect(cleanName('Miles Davis*')).toBe('Miles Davis');
    expect(cleanName('Sunn O)))')).toBe('Sunn O)))');
  });
});

describe('track lengths', () => {
  it('parses m:ss and h:mm:ss', () => {
    expect(parseTrackDuration('8:56')).toBe(536);
    expect(parseTrackDuration('1:02:03')).toBe(3723);
    expect(parseTrackDuration('')).toBeNull();
    expect(parseTrackDuration('about 3 min')).toBeNull();
  });

  it('skips section headings and counts medley parts', () => {
    expect(
      totalRuntime([
        { type_: 'heading', title: 'Side A' },
        { type_: 'track', duration: '3:00' },
        {
          type_: 'index',
          title: 'Medley',
          sub_tracks: [{ duration: '1:00' }, { duration: '2:00' }],
        },
      ]),
    ).toBe(360);
  });

  it('gives no total when any track is missing its length', () => {
    expect(totalRuntime([{ duration: '3:00' }, { duration: '' }])).toBeNull();
    expect(totalRuntime([])).toBeNull();
  });
});

describe('tracklists', () => {
  it('saves each song with its side and length', () => {
    expect(releaseToTracks(release)).toEqual([
      { position: 'A1', side: 'A', title: 'So What', durationSeconds: 536, sortOrder: 0 },
      {
        position: 'A2',
        side: 'A',
        title: 'Freddie Freeloader',
        durationSeconds: 572,
        sortOrder: 1,
      },
      { position: 'A3', side: 'A', title: 'Blue In Green', durationSeconds: 327, sortOrder: 2 },
      { position: 'B1', side: 'B', title: 'All Blues', durationSeconds: 694, sortOrder: 3 },
      { position: 'B2', side: 'B', title: 'Flamenco Sketches', durationSeconds: 572, sortOrder: 4 },
    ]);
  });

  it('reads the side from the position', () => {
    expect(sideOf('A1')).toBe('A');
    expect(sideOf('c3')).toBe('C');
    expect(sideOf('B')).toBe('B');
    expect(sideOf('AA')).toBe('AA'); // a double A-side single
    expect(sideOf('A1a')).toBe('A');
    expect(sideOf('1')).toBeNull(); // CD-style numbering
    expect(sideOf('Side A')).toBeNull();
    expect(sideOf(undefined)).toBeNull();
  });
});
