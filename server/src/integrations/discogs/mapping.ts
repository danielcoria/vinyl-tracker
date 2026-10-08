// ============================================================================
// mapping.ts: TURNS DISCOGS DATA INTO OUR RECORD FORMAT
//
// Discogs writes things differently from us, so this cleans them up:
//   "Nirvana (2)"                -> "Nirvana"   (Discogs numbers same-name artists)
//   "Miles Davis - Kind Of Blue" -> artist "Miles Davis", title "Kind Of Blue"
//   ["Vinyl", "LP", "Album"]     -> "LP";  2 x LP -> "2xLP"
//   tracklist durations          -> total length in seconds
//   a "spacer.gif" picture       -> no picture (Discogs' placeholder)
// ============================================================================

import type { DiscogsSearchResult, RecordInput } from '@vinyl/shared';
import type { RawRelease, RawSearchResult, RawTrack } from './schemas.js';

/** The format words we show, in order of preference (size before type). */
const FORMAT_WORDS = ['LP', '7"', '10"', '12"', 'EP', 'Single', 'Mini-Album', 'Maxi-Single'];

/** Removes Discogs' "(2)" numbering and the "*" it adds to name variations. */
export function cleanName(name: string): string {
  return name
    .replace(/\s+\(\d+\)$/, '')
    .replace(/\*$/, '')
    .trim();
}

/** Discogs shows a placeholder image ("spacer.gif") when there is no cover. */
function realImage(url: string | undefined): string | null {
  return url && !url.includes('spacer.gif') ? url : null;
}

function toYear(year: string | number | undefined): number | null {
  const n = Number(year);
  // Discogs uses 0 for "unknown"; our records only accept 1900 onwards.
  return Number.isInteger(n) && n >= 1900 ? n : null;
}

function formatFromWords(words: string[], quantity = 1): string | null {
  const word = FORMAT_WORDS.find((w) => words.includes(w)) ?? words[0] ?? null;
  if (word === null) return null;
  return quantity > 1 ? `${quantity}x${word}` : word;
}

/** One search result, in the shape the website shows (minus the collection check). */
export function toSearchResult(raw: RawSearchResult): Omit<DiscogsSearchResult, 'inCollectionId'> {
  // Search titles are "Artist - Title". Split at the first " - ".
  const split = raw.title.indexOf(' - ');
  const artist = split === -1 ? '' : raw.title.slice(0, split);
  const title = split === -1 ? raw.title : raw.title.slice(split + 3);

  return {
    releaseId: raw.id,
    title: title.trim(),
    // Several artists arrive as one string ("A & B"). Names can contain commas
    // ("Crosby, Stills, Nash & Young"), so don't split; just strip the markers.
    artist: artist
      .replace(/\s\(\d+\)/g, '')
      .replace(/\*/g, '')
      .trim(),
    year: toYear(raw.year),
    format: formatFromWords(raw.format ?? []),
    label: raw.label?.[0] ? cleanName(raw.label[0]) : null,
    catalogNumber: cleanCatalogNumber(raw.catno),
    country: raw.country ?? null,
    thumbUrl: realImage(raw.thumb) ?? realImage(raw.cover_image),
  };
}

function cleanCatalogNumber(catno: string | undefined): string | null {
  const value = catno?.trim();
  return value && value.toLowerCase() !== 'none' ? value : null;
}

/** Turns "8:56" or "1:02:03" into seconds. Returns null for "" or anything odd. */
export function parseTrackDuration(text: string | undefined): number | null {
  if (!text || !/^\d+(:\d{1,2}){1,2}$/.test(text.trim())) return null;
  return text
    .trim()
    .split(':')
    .map(Number)
    .reduce((total, n) => total * 60 + n, 0);
}

/**
 * Adds up the length of every track. Returns null if any track has no
 * duration, because a partial total would be misleading.
 */
export function totalRuntime(tracklist: RawTrack[]): number | null {
  // Headings are section titles, not tracks. An "index" groups sub-tracks (a medley).
  const tracks = tracklist.flatMap((track) => {
    if (track.type_ === 'heading') return [];
    if (track.type_ === 'index') {
      return track.sub_tracks && track.sub_tracks.length > 0 ? track.sub_tracks : [track];
    }
    return [track];
  });
  if (tracks.length === 0) return null;

  let total = 0;
  for (const track of tracks) {
    const seconds = parseTrackDuration(track.duration);
    if (seconds === null) return null;
    total += seconds;
  }
  return total > 0 ? total : null;
}

/** A full Discogs release, as the input our records service expects. */
export function releaseToRecordInput(release: RawRelease): RecordInput {
  const vinyl = release.formats.find((f) => f.name === 'Vinyl') ?? release.formats[0];
  const cover =
    release.images.find((image) => image.type === 'primary') ?? release.images[0] ?? null;
  const label = release.labels[0];
  const artists = release.artists.map((a) => cleanName(a.name)).filter(Boolean);

  return {
    title: release.title.trim().slice(0, 300),
    artists: artists.length > 0 ? artists.slice(0, 10) : ['Unknown Artist'],
    year: toYear(release.year),
    label: label ? cleanName(label.name) : null,
    catalogNumber: cleanCatalogNumber(label?.catno),
    format: vinyl
      ? formatFromWords(vinyl.descriptions ?? [vinyl.name], Number(vinyl.qty) || 1)
      : null,
    coverImageUrl: realImage(cover?.uri),
    runtimeSeconds: totalRuntime(release.tracklist),
    genres: release.genres.slice(0, 30),
    styles: release.styles.slice(0, 30),
  };
}
