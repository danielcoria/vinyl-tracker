# Vinyl Tracker

A collection tracker and **listening log for physical records**. Spotify and Last.fm only see digital streams; nothing records it when a record goes on a turntable. This app does. Every feature should support that angle.

Portfolio project, so code quality, tests, and a clean commit history matter as much as features.

## Status

M0–M3 are done (scaffold, CI, database + records API, collection UI). The next milestone is **M4 (Discogs search + import)**. Update this section and the milestone checklist as work lands.

## Features

Core:

- **Collection**: add records manually or import them from the Discogs API (search, then import release details).
- **Listening log**: log a "spin" (record, when, how long, which sides).
- **Stats**: most-played artists, genres/styles by month.

Vinyl-specific (the differentiators):

- **Dust report**: records you own but haven't played in N days, or have never played.
- **Stylus wear tracker**: adds up logged spin minutes against the active stylus's rated lifespan and warns when it's time to replace it.

Later:

- **Streaming vs. shelf**: compares Last.fm top albums with the collection ("streamed 200×, not on your shelf") and turns the gaps into wishlist suggestions.
- **Collection value over time**: periodic Discogs marketplace price snapshots, shown as a chart.

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

Planned:

- `styluses`: id, name, rated_hours, installed_at, retired_at (null = active; at most one active)
- `spins`: id, record_id, stylus_id (nullable), played_at, duration_seconds, sides (e.g. `"A,B"`), notes
- `settings`: key, value (dust threshold in days, Last.fm username, and so on)
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

| Method | Path                    | Notes                                                                                                            |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`           | `{ status, uptimeSeconds }`                                                                                      |
| GET    | `/api/records?q=&sort=` | `{ records }`. `q` matches title or artist; `sort` is `added` (default, newest first), `artist`, `title`, `year` |
| GET    | `/api/records/:id`      | 404 if missing                                                                                                   |
| POST   | `/api/records`          | Body: `recordInputSchema`. 201 + `Location` header                                                               |
| PUT    | `/api/records/:id`      | Full replace, including artists and tags                                                                         |
| DELETE | `/api/records/:id`      | 204                                                                                                              |

Validation errors are 400 `VALIDATION` with `field: message` pairs joined by `; `.

## Milestones

- [x] M0 Scaffold: workspaces, TS/ESLint/Prettier, Vite app, Express `/api/health`, Vitest wired up
- [x] M1 CI early: GitHub Actions running lint + typecheck + unit tests on every push/PR
- [x] M2 Database + records CRUD API (manual entry), migrations, seed data
- [x] M3 Collection UI: grid/list, detail page, add/edit form
- [ ] M4 Discogs search + import (server proxy, rate limit, cache) + UI
- [ ] M5 Listening log: log a spin, spin history
- [ ] M6 Stats: most-played artists, genres by month (charts)
- [ ] M7 Dust report
- [ ] M8 Stylus wear tracker
- [ ] M9 Playwright E2E for core flows; add to CI
- [ ] M10 Deploy (CD): Docker image + host with a persistent volume for SQLite
- [ ] M11 Streaming vs. shelf (Last.fm) + wishlist
- [ ] M12 Collection value over time (scheduled price snapshots)
- [ ] M13 Polish: README with screenshots/GIF, demo data, architecture notes
