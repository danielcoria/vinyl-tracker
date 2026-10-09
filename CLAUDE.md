# Vinyl Tracker

**A Letterboxd for physical music.** Track the records you own, keep a diary of what you play (by side), and later rate, review, share a public profile and get suggestions based on your own shelf. Discogs supplies record details; Last.fm supplies streaming history.

Similar apps exist for single pieces (vinyl scrobblers, spin loggers with stylus tracking, e.g. Discrobble, Dead Format, Spindle, Spun It, VinylScape), so the pitch is the combination: one web app that does the collection, the diary, the vinyl-specific tools and the social/discovery layer, with features built on data only this app has (what you own + what you actually play).

Portfolio project, so code quality, tests, and a clean commit history matter as much as features.

## Status

M0–M8 are done (scaffold, CI, database + records API, collection UI, Discogs search + import, listening log by side, stats, dust report, stylus wear tracker). The next milestone is **M9 (Playwright end-to-end tests)**. Update this section and the milestone checklist as work lands.

## Features

Built or in progress:

- **Collection**: add records manually or import them from Discogs (search, then import), including the tracklist.
- **Listening log (the diary)**: log a "spin" by side (A, B, C...): when it started, how long, which sides, which tracks. A full play is one click (all sides ticked). Song-level picking may come later; spins already store the tracks they covered.

Planned:

- **Stats**: most-played artists, genres/styles by month.
- **Dust report**: records you own but haven't played in N days, or never.
- **Stylus wear tracker**: logged play time against the stylus's rated lifespan.
- **Accounts**: sign up / log in; every user has their own collection and diary. The app is single-user until then; records will gain a user owner and spins inherit it through their record.
- **Public profiles** (owner's top priority among the new features): a shareable page of someone's shelf, most-played records and year in records.
- **Ratings and reviews**: Letterboxd-style, attached to records and to diary entries (spins).
- **"What should I play tonight?"**: suggests records from your own shelf by time available, genre and how long since they were last played.
- **Streaming vs. shelf with prices**: Last.fm top albums you don't own, with the current Discogs marketplace price ("streamed 214×, about $28 on vinyl"); optional Last.fm scrobbling of logged spins (per track, needs a tracklist; Last.fm only accepts recent timestamps).
- **Recommendations** based on what you own.
- **Collection value over time**: periodic Discogs price snapshots, charted.

## Stack

| Layer                  | Choice                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| Frontend               | React + TypeScript, Vite, React Router, TanStack Query, Recharts        |
| Backend                | Node.js + Express + TypeScript                                          |
| Database               | SQLite via `better-sqlite3`, with Drizzle ORM for schema and migrations |
| Validation             | Zod schemas in `shared/`, used by both the client and the server        |
| Unit/integration tests | Vitest (+ Supertest for the API, React Testing Library for the UI)      |
| E2E tests              | Playwright                                                              |
| CI/CD                  | GitHub Actions                                                          |

## Repository layout

npm workspaces monorepo:

```
client/          React app (Vite)
  src/
    api/         typed fetch wrappers + TanStack Query hooks
    components/  shared UI components
    features/    one folder per feature: collection/, discogs/, spins/, stats/, dust/, stylus/
    pages/       route-level components
server/
  src/
    app.ts       Express app factory (no listen(); used by tests)
    index.ts     entry point: loads config, calls listen()
    config.ts    env parsing (Zod), the only place that reads process.env
    paths.ts     SERVER_ROOT / REPO_ROOT; derive every filesystem path from these
    db/          schema.ts, client.ts (createDb), migrate.ts, seed.ts
    routes/      thin Express routers: parse input, call a service, send the response
    services/    business logic + SQL queries (stats, dust, stylus live here)
    integrations/ discogs/, lastfm/: HTTP clients, rate limiting, response mapping
    middleware/  error handler, request validation
  drizzle/       generated SQL migrations (committed; never edit after commit)
  test/          API tests via Supertest; helpers.ts gives an in-memory app
shared/          Zod schemas + inferred TS types for API contracts. Ships .ts source (no
                 build step); Vite bundles it for the client, tsup bundles it into server/dist
e2e/             Playwright specs + fixtures (Discogs mocked)
.github/workflows/
```

## Data model (SQLite)

Single user, no auth. Timestamps are ISO-8601 UTC strings. Durations are stored in seconds.

Built so far (M2), defined in `server/src/db/schema.ts`:

- `records`: id, discogs_release_id (unique, nullable for manual entries; set only by the server, never from client input), title, year, label, catalog_number, format, cover_image_url, runtime_seconds (summed from the Discogs tracklist and used as the default spin length), media_condition, sleeve_condition (Goldmine grades `M`…`P`, see `CONDITION_GRADES`), notes, added_at, updated_at
- `artists`: id, discogs_artist_id (unique, nullable), name (unique case-insensitively via an index on `lower(name)`). Artists are found-or-created by name; ones left with no records are deleted.
- `record_artists`: record_id (cascade delete), artist_id, position (0 = primary artist, used for sort-by-artist)
- `record_tags`: record_id (cascade delete), kind (`genre` | `style`), name
- `tracks` (M5): record_id (cascade), position ("A1"), side ("A" or null), title, duration_seconds, sort_order. Saved from Discogs on import/link; a tracklist used by logged spins is never replaced.
- `spins` (M5, the diary): record_id (cascade), played_at (start time), duration_seconds, sides ("A,B" in record order, or null = whole record), notes, created_at
- `spin_tracks` (M5): spin_id, track_id. Which tracks a spin covered (for song stats and scrobbling later)
- Records expose `spinCount` and `lastPlayedAt`, computed from `spins` in `hydrate()`, never stored.
- `settings` (M7): key, value (JSON text). Read through `services/settings.ts`, which validates each value against `settingsSchema` and falls back to `DEFAULT_SETTINGS`. Add new settings to the shared schema + defaults.
- `styluses` (M8): name, rated_hours, initial_hours, installed_at, retired_at (null = the one in use; at most one). Spins have NO stylus column: a stylus's wear is initial_hours + the spins whose played_at falls in [installed_at, retired_at), so back-dated spins count for the right stylus. Single turntable assumed.

Planned:

- Later: `wishlist_items`, `lastfm_album_cache`, `price_snapshots` (record_id, captured_at, lowest_price, currency, num_for_sale)

Derived values (stylus hours used, last-played date, dust status, stats) are **computed in queries, never stored**.

## Conventions

- **Beginner-friendly comments:** the owner is new to this stack. Every source file starts with a plain-language header comment (see existing files: a `// ====` block saying what the file is and does). Add inline comments where a React/Express/Drizzle/Zod concept appears for the first time. When files are added, moved or change purpose, update `docs/HOW-IT-WORKS.md` in the same commit.
- **TypeScript strict mode** everywhere. No `any`. Use `unknown` and narrow it with Zod.
- **API contracts live in `shared/`.** Define a Zod schema once and derive the TS type with `z.infer`. Don't redeclare types by hand on either side.
- **REST JSON API** under `/api`. Use plural nouns (`/api/records`, `/api/spins`) and return errors as `{ error: { code, message } }` with the correct status.
- **Layering:** routes → services → db. Routes never touch the DB directly. External APIs are reached only through `server/src/integrations/`.
- **Secrets stay server-side.** The Discogs token and Last.fm key are read from env and never sent to the client. The client only calls our own API.
- **Discogs:** always send a descriptive `User-Agent`, respect the 60 req/min limit, and cache responses. Tests never hit the real API; use recorded fixtures.
- **Database:** `better-sqlite3` is synchronous, so services and Drizzle queries are sync (`.get()`, `.all()`, `.run()`, `db.transaction((tx) => …)`). Multi-table writes go in a transaction. `createDb(path)` enables foreign keys and runs migrations; tests use `createDb(':memory:')` via `test/helpers.ts`.
- **Migrations:** edit `server/src/db/schema.ts`, then run `npm run db:generate -w server -- --name <what_changed>` and commit the generated SQL in `server/drizzle/`. The app applies pending migrations on startup. Never edit a migration that has been committed.
- **Search:** LIKE patterns are escaped with `!` (`ESCAPE '!'`), not backslash, so user input like `%` matches literally.
- **Naming:** camelCase in TS, snake_case in SQL columns, kebab-case filenames for non-components, PascalCase for React component files.
- **Frontend:** organize by feature, not by file type. Server state goes through TanStack Query, with no duplicated server data in local state.
- **Listening log UI (M5):** `features/spins/`. A spin stores its START time: "I just finished" = now minus the length. All sides ticked is sent as `sides: null`. Length auto-fills from `playLength()` (track lengths, else the album runtime for a full play) until the user types one. `mockApi()` defaults: empty tracklists and an empty diary. Website tests use a 3 s `findBy`/`waitFor` timeout (set in `test/setup.ts`) and a 15 s per-test limit (`vite.config.ts`) so they're not flaky on slower CI machines; `user` types with `delay: null` (fast), so tests must wait for buttons to be enabled before clicking (e.g. `openLogPanel()` in `RecordPlays.test.tsx`); sessionStorage is cleared after each test; jsdom gets a no-op `ResizeObserver` for charts.
- **Status colors (M8):** reserved for meaning (ok / soon / replace), never for data series; always paired with an icon and words (`features/stylus/status.ts`). Doc and code edits made by script must fail loudly when their anchor text is missing (no silent regex no-ops).
- **Charts (M6):** follow the dataviz skill. Categorical colors come from `features/stats/chart-colors.ts` (validated with its `validate_palette.js` against the app's card surfaces `#ffffff` / `#1f1b17`; light mode needs the table view as relief), assigned in fixed order and kept per entity across filters (`useStableSlots`). Every chart has a legend for 2+ series, a hover tooltip and a "Show as table" view. Recharts pages are lazy-loaded (`React.lazy` in `App.tsx`) to keep the main bundle small. After UI changes, screenshot the page (Playwright in the scratchpad, light + dark, 1100px + 390px) and look at it.
- **Frontend patterns (M3):** routes are listed in `client/src/App.tsx` (React Router v8, declarative `<Routes>`); pages live in `pages/`, feature pieces in `features/<feature>/`. Data goes through hooks in `api/` (TanStack Query; mutations invalidate `["records", ...]` keys). Forms keep text in state and validate with the shared Zod schema before sending (see `features/collection/form-values.ts`). Show errors with `describeError()`. Page tests render the whole app with `renderApp(route)` from `test/render.tsx` and fake the server with `mockApi()` from `test/fake-api.ts`; `data-testid="location"` shows the current address.
- **Tests:** every service and route gets Vitest coverage. API tests run against an in-memory SQLite DB through `app.ts`. Add a Playwright spec when a user-facing flow is completed.
- **Commits:** solo project, so commit directly to `main` (no feature branches or PRs unless asked). Write messages in plain, simple language with no "you", "your" or "I": a short past-tense title saying what changed (e.g. "Added record delete button"), then a few short bullets in the same style (e.g. "- Added a search box for title and artist"), in everyday words with no jargon. Keep commits small; one milestone may span several.
- **CI:** `.github/workflows/ci.yml` runs format:check, lint, typecheck, test and build on Node 22 and 24 for every PR and every push to `main`. Keep it green: run the same scripts locally before pushing. CI has no secrets, so tests must never need a real `.env` or network access.
- **Env:** a single `.env` at the repo root, loaded by `server/src/config.ts`. Document every variable in `.env.example`. Never commit `.env`, never log secret values, and never print or echo the contents of `.env`.

## Commands

Run from the repo root (Node ≥ 22):

```
npm run dev           # server on :3001 (tsx watch) + client on :5173 (Vite proxies /api)
npm test              # Vitest in every workspace
npm run typecheck     # tsc in every workspace
npm run lint          # ESLint (flat config at root)
npm run format        # Prettier write; format:check for CI
npm run build         # server -> server/dist (tsup), client -> client/dist (Vite)
npm test -w server    # one workspace only

npm run db:seed -w server               # sample records into an empty dev DB (data/vinyl.db)
npm run db:seed -w server -- --reset    # wipe records, then seed
npm run db:generate -w server -- --name x  # new migration from schema.ts changes
npm run db:migrate -w server            # apply migrations (the server also does this on start)
npm run db:studio -w server             # Drizzle Studio, a browser UI for the dev DB
```

Planned: `npm run test:e2e` (M9).

## API

| Method    | Path                                     | Notes                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET       | `/api/health`                            | `{ status, uptimeSeconds }`                                                                                                                                                                                                             |
| GET       | `/api/records?q=&sort=`                  | `{ records }`. `q` matches title or artist; `sort` is `added` (default, newest first), `artist`, `title`, `year`                                                                                                                        |
| GET       | `/api/records/:id`                       | 404 if missing                                                                                                                                                                                                                          |
| POST      | `/api/records`                           | Body: `recordInputSchema`. 201 + `Location` header                                                                                                                                                                                      |
| PUT       | `/api/records/:id`                       | Full replace, including artists and tags                                                                                                                                                                                                |
| DELETE    | `/api/records/:id`                       | 204                                                                                                                                                                                                                                     |
| GET       | `/api/records/:id/tracks`                | `{ tracks }` in record order: position, side (letter from the position, or null), title, durationSeconds                                                                                                                                |
| GET       | `/api/spins?recordId=&limit=`            | `{ spins }` newest first (by playedAt), each with a short `record` summary. limit 1-200, default 50                                                                                                                                     |
| POST      | `/api/spins`                             | `{ recordId, sides?, playedAt?, durationSeconds, notes? }`. `playedAt` = start time (default now, not in the future). `sides` null = whole record; all sides ticked is stored as null too. 400 `NO_SIDES` / `UNKNOWN_SIDE`              |
| DELETE    | `/api/spins/:id`                         | 204                                                                                                                                                                                                                                     |
| GET       | `/api/stats?from=&to=&utcOffsetMinutes=` | totals, topArtists, topRecords (10 each, ranked by listening TIME then plays), genresByMonth (top 5 genres + "Other"; a record's time is split evenly across its genres; months in the viewer's zone; `to` is exclusive; max 24 months) |
| GET       | `/api/dust?days=`                        | `{ thresholdDays, collectionCount, dusty, neverPlayed }`. dusty = last play strictly older than N days (longest-forgotten first); neverPlayed = no spins (longest-owned first). `days` defaults to the saved setting                    |
| GET / PUT | `/api/settings`                          | `{ dustThresholdDays }` (7-3650, default 90). PUT takes any subset                                                                                                                                                                      |
| GET       | `/api/styluses`                          | `{ styluses }` newest first, each with hoursUsed, spinCount, percentUsed, status (`ok` < 75% ≤ `soon` < 100% ≤ `replace`), averageSpinSeconds                                                                                           |
| POST      | `/api/styluses`                          | `{ name, ratedHours, initialHours?, installedAt? }`. Retires the current stylus at the new installedAt; 400 `INSTALLED_BEFORE_CURRENT` if not later                                                                                     |
| PUT       | `/api/styluses/:id`                      | name, ratedHours, initialHours (install/retire dates are fixed)                                                                                                                                                                         |
| DELETE    | `/api/styluses/:id`                      | 204. Deleting the active stylus re-activates the one it replaced                                                                                                                                                                        |
| GET       | `/api/discogs/search?q=&page=`           | `{ results, page, pages }`; each result has `inCollectionId` (record id if already imported). 20 per page, vinyl only                                                                                                                   |
| POST      | `/api/discogs/import`                    | `{ releaseId }`. 201 + new record; 409 `ALREADY_IN_COLLECTION` if imported before                                                                                                                                                       |
| POST      | `/api/discogs/link`                      | `{ recordId, releaseId }`. Sets the release id and fills only empty fields + cover; never overwrites user data                                                                                                                          |

Discogs routes answer 503 `DISCOGS_NOT_CONFIGURED` without a token. Discogs failures map to `DISCOGS_NOT_FOUND` (404), `DISCOGS_BUSY` (503, our 60/min limit or theirs), `DISCOGS_AUTH` / `DISCOGS_UNAVAILABLE` / `DISCOGS_BAD_RESPONSE` (502). Server tests use `fakeDiscogs()` from `test/discogs-helpers.ts` with recorded fixtures; never call the real API in tests.

Validation errors are 400 `VALIDATION` with `field: message` pairs joined by `; `.

## Milestones

- [x] M0 Scaffold: workspaces, TS/ESLint/Prettier, Vite app, Express `/api/health`, Vitest wired up
- [x] M1 CI early: GitHub Actions running lint + typecheck + unit tests on every push/PR
- [x] M2 Database + records CRUD API (manual entry), migrations, seed data
- [x] M3 Collection UI: grid/list, detail page, add/edit form
- [x] M4 Discogs search + import (server proxy, rate limit, cache) + UI
- [x] M5 Listening log by side: save tracklists, log a spin (sides, start time, length), diary/history page
- [x] M6 Stats: most-played artists, genres by month (charts)
- [x] M7 Dust report
- [x] M8 Stylus wear tracker
- [ ] M9 Playwright E2E for core flows; add to CI
- [ ] M10 Deploy (CD): Docker image + host with a persistent volume for SQLite
- [ ] M11 Accounts: sign up, log in, sessions, per-user collections (migrate existing data to a first user)
- [ ] M12 Public profiles: shareable shelf, most-played, year in records
- [ ] M13 Ratings and reviews (on records and on diary entries)
- [ ] M14 "What should I play tonight?" picker
- [ ] M15 Streaming vs. shelf with Discogs prices (Last.fm) + wishlist; optional scrobbling
- [ ] M16 Recommendations based on what you own
- [ ] M17 Collection value over time (scheduled price snapshots)
- [ ] M18 Polish: README with screenshots/GIF, demo data, architecture notes
