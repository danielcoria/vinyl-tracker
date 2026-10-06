// Fills an empty database with sample records for local development.
//   npm run db:seed            -> only seeds if there are no records yet
//   npm run db:seed -- --reset -> deletes every record first
import { count } from 'drizzle-orm';
import { recordInputSchema, type RecordInput } from '@vinyl/shared';
import { loadConfig } from '../config.js';
import { createRecord } from '../services/records.js';
import { createDb } from './client.js';
import { artists, records } from './schema.js';

const SAMPLE_RECORDS: RecordInput[] = [
  {
    title: 'The Dark Side of the Moon',
    artists: ['Pink Floyd'],
    year: 1973,
    label: 'Harvest',
    catalogNumber: 'SHVL 804',
    format: 'LP',
    runtimeSeconds: 2569,
    mediaCondition: 'VG+',
    sleeveCondition: 'VG',
    genres: ['Rock'],
    styles: ['Prog Rock', 'Psychedelic Rock'],
  },
  {
    title: 'Kind of Blue',
    artists: ['Miles Davis'],
    year: 1959,
    label: 'Columbia',
    catalogNumber: 'CL 1355',
    format: 'LP',
    runtimeSeconds: 2744,
    mediaCondition: 'VG',
    sleeveCondition: 'G+',
    notes: 'Mono pressing from a record fair.',
    genres: ['Jazz'],
    styles: ['Modal', 'Cool Jazz'],
  },
  {
    title: 'Bitches Brew',
    artists: ['Miles Davis'],
    year: 1970,
    label: 'Columbia',
    catalogNumber: 'GP 26',
    format: '2xLP',
    runtimeSeconds: 5637,
    mediaCondition: 'NM',
    sleeveCondition: 'VG+',
    genres: ['Jazz'],
    styles: ['Fusion'],
  },
  {
    title: 'A Love Supreme',
    artists: ['John Coltrane'],
    year: 1965,
    label: 'Impulse!',
    catalogNumber: 'A-77',
    format: 'LP',
    runtimeSeconds: 1982,
    mediaCondition: 'VG+',
    sleeveCondition: 'VG+',
    genres: ['Jazz'],
    styles: ['Hard Bop', 'Modal'],
  },
  {
    title: 'Rumours',
    artists: ['Fleetwood Mac'],
    year: 1977,
    label: 'Warner Bros. Records',
    catalogNumber: 'BSK 3010',
    format: 'LP',
    runtimeSeconds: 2383,
    mediaCondition: 'VG+',
    sleeveCondition: 'VG',
    genres: ['Rock'],
    styles: ['Pop Rock', 'Soft Rock'],
  },
  {
    title: 'The Velvet Underground & Nico',
    artists: ['The Velvet Underground', 'Nico'],
    year: 1967,
    label: 'Verve Records',
    catalogNumber: 'V6-5008',
    format: 'LP',
    runtimeSeconds: 2931,
    mediaCondition: 'NM',
    sleeveCondition: 'NM',
    notes: 'Reissue. Banana sleeve does not peel.',
    genres: ['Rock'],
    styles: ['Art Rock', 'Garage Rock'],
  },
  {
    title: "What's Going On",
    artists: ['Marvin Gaye'],
    year: 1971,
    label: 'Tamla',
    catalogNumber: 'TS310',
    format: 'LP',
    runtimeSeconds: 2131,
    mediaCondition: 'VG',
    sleeveCondition: 'VG',
    genres: ['Funk / Soul'],
    styles: ['Soul'],
  },
  {
    title: 'Blue',
    artists: ['Joni Mitchell'],
    year: 1971,
    label: 'Reprise Records',
    catalogNumber: 'MS 2038',
    format: 'LP',
    runtimeSeconds: 2175,
    mediaCondition: 'VG+',
    sleeveCondition: 'VG',
    genres: ['Rock', 'Folk, World, & Country'],
    styles: ['Folk Rock'],
  },
  {
    title: 'OK Computer',
    artists: ['Radiohead'],
    year: 1997,
    label: 'Parlophone',
    catalogNumber: 'NODATA 02',
    format: '2xLP',
    runtimeSeconds: 3201,
    mediaCondition: 'M',
    sleeveCondition: 'M',
    genres: ['Electronic', 'Rock'],
    styles: ['Alternative Rock', 'Art Rock'],
  },
  {
    title: 'Discovery',
    artists: ['Daft Punk'],
    year: 2001,
    label: 'Virgin',
    catalogNumber: '7243 8 49606 1 6',
    format: '2xLP',
    runtimeSeconds: 3650,
    mediaCondition: 'NM',
    sleeveCondition: 'VG+',
    genres: ['Electronic'],
    styles: ['House', 'Disco'],
  },
  {
    title: 'To Pimp a Butterfly',
    artists: ['Kendrick Lamar'],
    year: 2015,
    label: 'Top Dawg Entertainment',
    catalogNumber: 'B0023163-01',
    format: '2xLP',
    runtimeSeconds: 4731,
    mediaCondition: 'NM',
    sleeveCondition: 'NM',
    genres: ['Hip Hop', 'Jazz', 'Funk / Soul'],
    styles: ['Conscious'],
  },
];

const reset = process.argv.includes('--reset');
const db = createDb(loadConfig().databasePath);

if (reset) {
  db.transaction((tx) => {
    tx.delete(records).run(); // cascades to credits and tags
    tx.delete(artists).run();
  });
  console.log('Deleted all records.');
}

const existing = db.select({ n: count() }).from(records).get()?.n ?? 0;
if (existing > 0) {
  console.log(`Database already has ${existing} records; skipping. Use --reset to start over.`);
} else {
  for (const sample of SAMPLE_RECORDS) {
    createRecord(db, recordInputSchema.parse(sample));
  }
  console.log(`Seeded ${SAMPLE_RECORDS.length} records.`);
}
