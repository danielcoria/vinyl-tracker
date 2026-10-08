# How Vinyl Tracker Works

A plain-language tour of the project for anyone new to it, including people who have never used React, Express or TypeScript.

## The big picture

The app has **three parts**, each in its own folder:

| Folder    | What it is                                                                                         | Think of it as…                                   |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `client/` | The **website** you see in the browser (built with React)                                          | The restaurant's dining room                      |
| `server/` | The **server**, which stores your records and answers the website's questions (built with Express) | The kitchen                                       |
| `shared/` | The **contracts**: exact descriptions of what the data looks like, used by both sides              | The menu both the waiter and the kitchen agree on |

They talk like this:

```
 You click something
        │
        ▼
 ┌──────────────┐   "GET /api/records"    ┌──────────────┐   SQL query    ┌────────────────┐
 │   WEBSITE    │ ──────────────────────▶ │    SERVER    │ ─────────────▶ │    DATABASE    │
 │  (client/)   │                         │  (server/)   │                │ data/vinyl.db  │
 │  port 5173   │ ◀────────────────────── │  port 3001   │ ◀───────────── │                │
 └──────────────┘   list of records       └──────────────┘    rows        └────────────────┘
                    (as JSON)
```

- The website **never** touches the database directly. It always asks the server.
- The server is the only part that knows secrets, such as your Discogs token.
- **JSON** is the text format they use to send data back and forth. It looks like `{ "title": "Blue", "year": 1971 }`.

## What happens when you run `npm run dev`

1. Two programs start at once:
   - the **server** (`server/src/index.ts`) on port 3001
   - the **website** (run by a tool called Vite) on port 5173
2. The server reads your settings from `.env`, opens the database file `data/vinyl.db`, and **waits** for requests.
3. Vite also **waits**, for you to open http://localhost:5173.

The terminal goes quiet after startup because both programs are just waiting. That's normal. Press **Ctrl + C** to stop them.

## What happens when you open the page

1. The browser loads `client/index.html`, an almost-empty page.
2. That page loads `client/src/main.tsx`, which starts React.
3. React draws `App` (`client/src/App.tsx`), which looks at the address bar and picks a screen. For `/` that's the collection page.
4. The collection page asks the server for your records by calling `GET /api/records`.
5. Vite forwards anything starting with `/api` to the server on port 3001.
6. The server reads the database and answers with the records as JSON, and React draws a card for each one.

### The screens

| Address           | Screen                                                     | File                         |
| ----------------- | ---------------------------------------------------------- | ---------------------------- |
| `/`               | Your collection: a grid with search and sort               | `pages/CollectionPage.tsx`   |
| `/records/new`    | Add a record (a form)                                      | `pages/NewRecordPage.tsx`    |
| `/records/5`      | Everything about record 5, with Edit and Delete            | `pages/RecordDetailPage.tsx` |
| `/records/5/edit` | The same form as "add", filled in with record 5            | `pages/EditRecordPage.tsx`   |
| `/discogs`        | Search Discogs and add a release with one click            | `pages/DiscogsPage.tsx`      |
| `/discogs?link=5` | "Find on Discogs" for record 5: fills in its cover         | `pages/DiscogsPage.tsx`      |
| `/diary`          | Your listening diary: every play, newest first, by day     | `pages/DiaryPage.tsx`        |
| `/stats`          | Totals, most-listened artists and records, genres by month | `pages/StatsPage.tsx`        |
| anything else     | "Not found"                                                | `pages/NotFoundPage.tsx`     |

### What happens when you save the form

1. You press **Add record**. The form (`RecordForm.tsx`) checks what you typed using the **same rules the server uses** (from `shared/src/records.ts`). Problems appear next to each field and nothing is sent.
2. If everything is fine, the page sends it: `POST /api/records` for a new record, `PUT /api/records/5` for an edit.
3. The server checks it again (never trust the browser), saves it, and sends back the saved record.
4. TanStack Query marks the record list as out of date, so the collection refreshes by itself, and you're taken to the record's page.

## The tools, in one line each

| Tool                    | What it does                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**             | Runs JavaScript outside the browser. Our server runs on it.                                                                                     |
| **npm**                 | Installs libraries (into `node_modules/`) and runs commands like `npm run dev`.                                                                 |
| **npm workspaces**      | Lets one project contain several packages (`client`, `server`, `shared`) that can use each other.                                               |
| **TypeScript**          | JavaScript plus "types" (this is a number, that is text), so mistakes are caught before the code runs. Files end in `.ts`, or `.tsx` for React. |
| **React**               | Builds the website out of "components": functions that return what should appear on screen.                                                     |
| **JSX**                 | The HTML-looking code inside React components. Values go in `{curly braces}`.                                                                   |
| **Vite**                | Runs the website while you develop (instant reload on save) and bundles it for going online.                                                    |
| **TanStack Query**      | Fetches data from the server for React, remembers it, and tells the page when it's loading or failed.                                           |
| **Express**             | Turns our code into a web server: "when someone asks for this address, run this function".                                                      |
| **SQLite**              | A database that lives in a single file (`data/vinyl.db`). No separate database program needed.                                                  |
| **Drizzle**             | Lets us talk to the database in TypeScript instead of writing raw SQL everywhere.                                                               |
| **Zod**                 | Describes the shape of data ("a schema") and checks real data against it. Also gives TypeScript matching types.                                 |
| **Vitest**              | Runs our automatic tests (`npm test`).                                                                                                          |
| **Supertest**           | Sends pretend requests to the server inside tests.                                                                                              |
| **ESLint**              | Reads code looking for mistakes and bad habits (`npm run lint`).                                                                                |
| **Prettier**            | Formats code consistently: spacing, quotes, line length (`npm run format`).                                                                     |
| **GitHub Actions (CI)** | On every push, GitHub runs all the checks on a fresh computer. Green check = all good.                                                          |

## File-by-file tour

Every code file also starts with a comment explaining what it does, so you can open any file and read its top.

### Project root

| File                       | What it does                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `package.json`             | Names the three workspaces and defines the main commands (`dev`, `test`, `lint`…).                |
| `package-lock.json`        | The exact version of every installed library, so everyone gets the same ones. Never edit by hand. |
| `.env`                     | **Your secrets** (the Discogs token). Ignored by Git, so it never goes to GitHub.                 |
| `.env.example`             | A blank copy of `.env` that _is_ committed, so others know which settings exist.                  |
| `.gitignore`               | Files Git should never save: `node_modules/`, `.env`, the database, build output.                 |
| `.gitattributes`           | Makes line endings the same on Windows and Linux, so CI doesn't complain.                         |
| `.nvmrc`                   | Which Node.js version this project uses (24).                                                     |
| `tsconfig.base.json`       | TypeScript settings shared by all three folders.                                                  |
| `eslint.config.js`         | Rules for the code checker.                                                                       |
| `.prettierrc.json`         | Formatting preferences (single quotes, semicolons, 100-character lines).                          |
| `.prettierignore`          | Files Prettier should skip.                                                                       |
| `.github/workflows/ci.yml` | The automatic checks GitHub runs on every push.                                                   |
| `CLAUDE.md`                | Project notes for Claude Code (the AI assistant): goals, conventions, milestones.                 |
| `README.md`                | The project's front page on GitHub.                                                               |

### `shared/`: the contracts

| File              | What it does                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/records.ts`  | **What a record looks like**: the rules for adding or editing one (title required, valid year, condition grades…) and the shape sent back. |
| `src/health.ts`   | The shape of the "are you alive?" answer.                                                                                                  |
| `src/errors.ts`   | The one format every error uses: `{ "error": { "code", "message" } }`.                                                                     |
| `src/discogs.ts`  | What Discogs search results and imports look like, as our server sends them to the website.                                                |
| `src/spins.ts`    | What a track and a logged play ("spin") look like, and the rules for logging one (e.g. no plays in the future).                            |
| `src/stats.ts`    | What the Stats page gets: totals, top artists and records, and genres by month.                                                            |
| `src/dust.ts`     | What the dust report looks like: records gathering dust and never played.                                                                  |
| `src/settings.ts` | The app's settings (like how many days counts as "dusty") and their defaults.                                                              |
| `src/index.ts`    | Re-exports everything so other code can `import { … } from '@vinyl/shared'`.                                                               |

### `server/`: the kitchen

The server is organized in layers. A request flows down through them:

```
request ─▶ app.ts ─▶ routes/ ─▶ services/ ─▶ db/ ─▶ database file
            (which      (check the   (do the real   (tables and
            address?)   input)       work)          connection)
```

| File                                                                       | What it does                                                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                                             | **Start here.** Reads settings, opens the database, starts listening on port 3001.                                  |
| `src/app.ts`                                                               | Builds the server and lists every address it answers (`/api/health`, `/api/records`…).                              |
| `src/config.ts`                                                            | Reads and checks settings from `.env`. The only file allowed to.                                                    |
| `src/paths.ts`                                                             | Works out where folders are on disk.                                                                                |
| `src/errors.ts`                                                            | Our error types, e.g. `NotFoundError` becomes a 404.                                                                |
| `src/middleware/error-handler.ts`                                          | Turns any error into the standard error response.                                                                   |
| `src/routes/records.ts`                                                    | The record addresses: list, get, add, edit, delete. Short on purpose: check input, call the service, reply.         |
| `src/services/records.ts`                                                  | **The real work**: searching, sorting, saving and deleting records in the database.                                 |
| `src/routes/spins.ts`                                                      | The diary addresses: list plays, log a play, delete a play.                                                         |
| `src/services/spins.ts`                                                    | **The listening diary**: logs a play (which sides, when, how long, which songs) and lists plays newest first.       |
| `src/services/tracks.ts`                                                   | A record's tracklist: reads it, and saves it from Discogs (keeping one that logged plays depend on).                |
| `src/routes/stats.ts`                                                      | The Stats address: numbers for a chosen period.                                                                     |
| `src/services/stats.ts`                                                    | **Adds up the diary**: totals, most-listened artists and records, listening time per genre per month.               |
| `src/routes/dust.ts`                                                       | The dust report and settings addresses.                                                                             |
| `src/services/dust.ts`                                                     | **The dust report**: finds records not played in N days, and records never played.                                  |
| `src/services/settings.ts`                                                 | Reads and saves settings, using defaults for anything not saved yet.                                                |
| `src/routes/discogs.ts`                                                    | The Discogs addresses: search, import a release, link a record to a release.                                        |
| `src/services/discogs.ts`                                                  | Searches Discogs, imports a release as a new record, or fills in an existing record (cover and empty details only). |
| `src/integrations/discogs/client.ts`                                       | **Talks to Discogs.** Sends the token, remembers recent answers, stays under 60 requests a minute.                  |
| `src/integrations/discogs/mapping.ts`                                      | Converts Discogs data to our format: cleans names, picks the format, adds up track lengths.                         |
| `src/integrations/discogs/schemas.ts`                                      | The fields we read from Discogs, checked so surprises are caught early.                                             |
| `src/integrations/discogs/rate-limiter.ts`, `ttl-cache.ts`                 | The 60-a-minute limit and the memory of recent answers.                                                             |
| `src/db/schema.ts`                                                         | **The database tables** and their columns.                                                                          |
| `src/db/client.ts`                                                         | Opens the database file and makes sure its tables are up to date.                                                   |
| `src/db/seed.ts`                                                           | Adds 11 sample albums for development.                                                                              |
| `src/db/migrate.ts`                                                        | Applies database updates by hand (the server also does it on start).                                                |
| `drizzle/`                                                                 | **Migrations**: generated files of instructions that create and update the tables. Committed; never edited by hand. |
| `test/`                                                                    | Automatic tests. `helpers.ts` gives each test its own temporary database.                                           |
| `test/fixtures/discogs/`                                                   | Real Discogs answers saved as files, so tests never contact Discogs or need a token.                                |
| `drizzle.config.ts`, `tsup.config.ts`, `vitest.config.ts`, `tsconfig.json` | Settings for the database tools, the build, the tests and TypeScript.                                               |

### `client/`: the dining room

The website is organized in layers too:

```
pages/ ─▶ features/collection/ ─▶ api/ ─▶ server
(one per    (pieces of screens:     (talks to
 screen)     cards, form, covers)    the server)
```

| File                                           | What it does                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                                   | The single, nearly empty HTML page. React fills it in.                                                                     |
| `src/main.tsx`                                 | **Start here.** Plugs React into the page and sets up data fetching and the router.                                        |
| `src/App.tsx`                                  | **The list of screens**: which page to show for each address.                                                              |
| `src/components/Layout.tsx`                    | The frame around every screen: header with the app name, footer with the server status.                                    |
| `src/pages/CollectionPage.tsx`                 | The home screen: a grid of your records with search and sort.                                                              |
| `src/pages/RecordDetailPage.tsx`               | One record's page, with Edit and Delete.                                                                                   |
| `src/pages/NewRecordPage.tsx`                  | The "Add a record" screen.                                                                                                 |
| `src/pages/EditRecordPage.tsx`                 | The "Edit record" screen.                                                                                                  |
| `src/pages/DiscogsPage.tsx`                    | Search Discogs. "Add to collection" imports a release; in link mode, "Use this release" fills in an existing record.       |
| `src/pages/DiaryPage.tsx`                      | The listening diary: every logged play, grouped by day.                                                                    |
| `src/pages/StatsPage.tsx`                      | The Stats page: pick a period, see totals, top 10 lists and the genre chart. Loaded lazily (see below).                    |
| `src/pages/NotFoundPage.tsx`                   | Shown for addresses (or records) that don't exist.                                                                         |
| `src/features/discogs/DiscogsResult.tsx`       | One release in the Discogs results: thumbnail, details, and a button.                                                      |
| `src/features/spins/RecordPlays.tsx`           | The listening part of a record's page: play count, "Log a play", its plays and its tracklist.                              |
| `src/features/spins/LogSpinPanel.tsx`          | **The "Log a play" panel**: tick sides, choose when, and the length fills itself in.                                       |
| `src/features/spins/SpinList.tsx`              | A list of plays (used on the Diary page and on record pages), with delete buttons.                                         |
| `src/features/spins/Tracklist.tsx`             | A record's songs, grouped by side, with lengths.                                                                           |
| `src/features/spins/sides.ts`                  | Groups tracks by side, adds up side lengths, and writes "Sides A & C".                                                     |
| `src/features/spins/dates.ts`                  | Shows times in your local time zone ("7:30 PM", "Monday, October 6").                                                      |
| `src/features/stats/GenresByMonth.tsx`         | **The genre chart** (stacked columns per month, a hover box, and "Show as table"). Drawn with Recharts.                    |
| `src/features/stats/chart-colors.ts`           | The chart's colors, checked to be colorblind-safe in light and dark mode. A genre keeps its color when you switch periods. |
| `src/features/stats/RankedBars.tsx`            | A top-10 list with a bar for each entry and the numbers at the end of the bar.                                             |
| `src/features/stats/StatTiles.tsx`             | The row of big numbers (plays, hours, records, artists).                                                                   |
| `src/features/stats/format.ts`                 | Writes times like "12.5 h" and "1 h 05 min", and months like "Oct".                                                        |
| `src/features/collection/RecordForm.tsx`       | **The add/edit form**: every field, the problem messages, and the Save button.                                             |
| `src/features/collection/form-values.ts`       | Converts between what you type ("42:49") and what the server wants (2569 seconds), and checks it.                          |
| `src/features/collection/TagInput.tsx`         | The box for genres and styles: type, press Enter, get a chip with an ×.                                                    |
| `src/features/collection/RecordCard.tsx`       | One record in the grid.                                                                                                    |
| `src/features/collection/RecordCover.tsx`      | The cover picture, or a drawn vinyl disc when there isn't one.                                                             |
| `src/features/collection/format.ts`            | Turns data into text: artist lists, lengths ("42:49"), condition names ("Very Good Plus").                                 |
| `src/features/collection/useRecordId.ts`       | Reads the record number from the address (`/records/5` gives 5).                                                           |
| `src/features/collection/useDebouncedValue.ts` | Waits until you stop typing before searching.                                                                              |
| `src/api/client.ts`                            | The one place the website sends requests to the server, plus friendly error messages.                                      |
| `src/api/records.ts`                           | Hooks for records: `useRecords`, `useRecord`, `useCreateRecord`, `useUpdateRecord`, `useDeleteRecord`.                     |
| `src/api/discogs.ts`                           | Hooks for Discogs: `useDiscogsSearch`, `useImportRelease`, `useLinkRecord`. They only talk to our server.                  |
| `src/api/spins.ts`                             | Hooks for the diary: `useTracks`, `useSpins`, `useLogSpin`, `useDeleteSpin`.                                               |
| `src/api/stats.ts`                             | `useStats(period)`: turns "this year" into an exact start time in your time zone and fetches the numbers.                  |
| `src/api/health.ts`                            | A hook (`useHealth`) for the server status shown in the footer.                                                            |
| `src/index.css`                                | How everything looks, including light and dark mode.                                                                       |
| `src/test/fake-api.ts`                         | A pretend server for tests, plus `makeRecord()` for sample data.                                                           |
| `src/test/render.tsx`                          | Draws the whole app in a test, starting at any address.                                                                    |
| `src/test/setup.ts`                            | Runs before website tests.                                                                                                 |
| `*.test.ts`, `*.test.tsx`                      | Tests, next to the file they test.                                                                                         |
| `vite.config.ts`                               | Settings for Vite, including forwarding `/api` requests to the server.                                                     |

### How importing from Discogs works

1. You search on the **Add from Discogs** page. The website asks _our_ server (`GET /api/discogs/search`).
2. Our server asks Discogs, using the token from `.env`. The token never reaches the browser.
3. Our server simplifies the answer and marks releases you already own, then sends it to the website.
4. You click **Add to collection**. Our server fetches the full release (artists, label, tracklist, cover), converts it into a record (adding up the track lengths for the total length), and saves it.
5. Answers from Discogs are remembered for a while, and the server never sends more than 60 requests a minute (Discogs' limit).

### How logging a play works

1. On a record's page, press **Log a play**. Every side is ticked, so a full play is one more click.
2. Untick the sides you didn't play. The length adds up the songs on the sides you kept (from the tracklist saved from Discogs).
3. Choose when: "I just finished" (the play started one length ago), "I'm starting now", or a specific start time.
4. The website sends it to `POST /api/spins`. The server checks the sides really are on that record, saves the play, and remembers which songs it covered (for song stats and Last.fm later).
5. The record's play count, its list of plays and the Diary all refresh by themselves.

Records added by hand have no tracklist, so they log the whole record using the album's length (or a length you type).

## Words you'll see a lot

- **API**: the list of addresses the server answers, like `GET /api/records`. It's how the website and server talk.
- **Request / response**: the website sends a request ("give me the records") and the server sends back a response (the records).
- **GET / POST / PUT / DELETE**: the type of request: read, create, replace, remove.
- **Status code**: a number on every response. `200` OK, `201` created, `204` done with nothing to send back, `400` your input was wrong, `404` not found, `500` the server has a bug.
- **Component**: a React function that returns part of the page.
- **Hook**: a React function starting with `use` (like `useHealth`) that gives a component data or abilities.
- **State**: a component's own memory (`useState`), like what you've typed into the form so far. When it changes, React redraws.
- **Route**: a pairing of an address (like `/records/:id`) with the screen to show. `:id` is a placeholder for the record number.
- **Spin**: one logged play of a record, an entry in the diary.
- **Side**: one side of a vinyl disc (A, B; a double album also has C and D). Track positions like "A1" or "C3" say which side a song is on.
- **Rate limit**: the most requests a service allows in a period of time. Discogs allows 60 a minute.
- **Cache**: a short-term memory of answers, so the same question isn't asked twice.
- **Lazy loading**: downloading part of the website only when it's needed. The Stats page and its chart library load the first time you open Stats, so other pages start faster.
- **Query / mutation**: in TanStack Query, a query _reads_ data (the record list) and a mutation _changes_ it (add, edit, delete).
- **Schema**: a description of what data must look like, used to check it.
- **Migration**: a file of instructions that changes the database's tables.
- **Commit**: a saved snapshot of the code on your computer. **Push**: uploading commits to GitHub.

## Commands cheat sheet

Run these from the project folder:

| Command                                | What it does                                              |
| -------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                          | Start the server and website. Open http://localhost:5173. |
| `npm test`                             | Run all automatic tests.                                  |
| `npm run lint`                         | Check code for mistakes.                                  |
| `npm run typecheck`                    | Check TypeScript types.                                   |
| `npm run format`                       | Auto-format all code.                                     |
| `npm run db:seed -w server`            | Add sample albums (only if the database is empty).        |
| `npm run db:seed -w server -- --reset` | Delete all records, then add the sample albums.           |
| `npm run db:studio -w server`          | Open a browser tool for looking inside the database.      |

(`-w server` means "run this inside the server workspace".)
