// ============================================================================
// fetch-demo-data.mjs: SAVES THE DEMO ALBUMS FROM DISCOGS INTO THE PROJECT
//
// Run once (needs DISCOGS_TOKEN in .env):   node scripts/fetch-demo-data.mjs
//
// For each album below it searches Discogs, picks a vinyl pressing whose
// tracklist has every song's length (so sides and album length work), and
// saves the details the app uses to server/src/db/demo-releases.json.
// The online demo loads that file on every start, so it never has to contact
// Discogs just to fill itself in. The token is only sent to Discogs, never printed.
// ============================================================================

import { writeFileSync } from 'node:fs';

process.loadEnvFile(new URL('../.env', import.meta.url));
const token = process.env.DISCOGS_TOKEN;
if (!token) throw new Error('DISCOGS_TOKEN is missing from .env');
const headers = {
  Authorization: `Discogs token=${token}`,
  'User-Agent': process.env.DISCOGS_USER_AGENT ?? 'VinylTracker/0.1',
};

const ALBUMS = [
  'Miles Davis Kind of Blue',
  'John Coltrane A Love Supreme',
  'Fleetwood Mac Rumours',
  'Pink Floyd The Dark Side of the Moon',
  'The Beatles Abbey Road',
  'Joni Mitchell Blue',
  "Marvin Gaye What's Going On",
  'Prince Purple Rain',
  'Nirvana Nevermind',
  'Radiohead OK Computer',
  'Amy Winehouse Back to Black',
  'Daft Punk Discovery',
  'Kendrick Lamar To Pimp a Butterfly',
  'Daft Punk Random Access Memories',
];

const pause = () => new Promise((resolve) => setTimeout(resolve, 1200)); // ~50 requests a minute at most

async function get(path) {
  await pause();
  const res = await fetch(`https://api.discogs.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const hasAllDurations = (release) => {
  const tracks = release.tracklist.flatMap((t) =>
    t.type_ === 'heading' ? [] : t.type_ === 'index' && t.sub_tracks?.length ? t.sub_tracks : [t],
  );
  return tracks.length > 0 && tracks.every((t) => /^\d+(:\d{1,2}){1,2}$/.test(t.duration ?? ''));
};

const hasSides = (release) => release.tracklist.some((t) => /^[A-D]\d/.test(t.position ?? ''));

const saved = [];
for (const query of ALBUMS) {
  const params = new URLSearchParams({ q: query, type: 'release', format: 'Vinyl', per_page: '8' });
  const { results } = await get(`/database/search?${params}`);
  let picked = null;
  for (const result of results.slice(0, 6)) {
    if (!result.cover_image || result.cover_image.includes('spacer.gif')) continue;
    const release = await get(`/releases/${result.id}`);
    if (hasAllDurations(release) && hasSides(release) && release.images?.length) {
      picked = release;
      break;
    }
  }
  if (!picked) {
    console.log(`  ✗ ${query}: no pressing with a complete tracklist, skipped`);
    continue;
  }
  // Only the fields the app reads (the same ones as the server's test fixtures).
  saved.push({
    id: picked.id,
    title: picked.title,
    year: picked.year,
    country: picked.country,
    artists: picked.artists.map(({ id, name }) => ({ id, name })),
    labels: picked.labels.map(({ name, catno }) => ({ name, catno })),
    formats: picked.formats.map(({ name, qty, descriptions }) => ({ name, qty, descriptions })),
    genres: picked.genres ?? [],
    styles: picked.styles ?? [],
    tracklist: picked.tracklist.map(({ position, type_, title, duration, sub_tracks }) => ({
      position,
      type_,
      title,
      duration,
      ...(sub_tracks
        ? {
            sub_tracks: sub_tracks.map(({ position, type_, title, duration }) => ({
              position,
              type_,
              title,
              duration,
            })),
          }
        : {}),
    })),
    images: picked.images.slice(0, 1).map(({ type, uri }) => ({ type, uri })),
  });
  console.log(`  ✓ ${query}: release ${picked.id} (${picked.year}, ${picked.country})`);
}

const out = new URL('../server/src/db/demo-releases.json', import.meta.url);
writeFileSync(out, JSON.stringify(saved, null, 2) + '\n');
console.log(`Saved ${saved.length} albums to server/src/db/demo-releases.json`);
