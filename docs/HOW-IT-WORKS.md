# How Vinyl Tracker Works

A plain-language tour of the project for anyone new to it, including people who have never used React, Express or TypeScript. For the reasoning behind the design, with diagrams, see [ARCHITECTURE.md](ARCHITECTURE.md).

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

| Address               | Screen                                                                                             | File                                          |
| --------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `/`                   | Your collection: a grid with search and sort                                                       | `pages/CollectionPage.tsx`                    |
| `/records/new`        | Add a record (a form)                                                                              | `pages/NewRecordPage.tsx`                     |
| `/records/5`          | Everything about record 5, with Edit and Delete                                                    | `pages/RecordDetailPage.tsx`                  |
| `/records/5/edit`     | The same form as "add", filled in with record 5                                                    | `pages/EditRecordPage.tsx`                    |
| `/discogs`            | Search Discogs and add a release with one click                                                    | `pages/DiscogsPage.tsx`                       |
| `/discogs?link=5`     | "Find on Discogs" for record 5: fills in its cover                                                 | `pages/DiscogsPage.tsx`                       |
| `/diary`              | Your listening diary: every play, newest first, by day                                             | `pages/DiaryPage.tsx`                         |
| `/stats`              | Totals, most-listened artists and records, genres by month                                         | `pages/StatsPage.tsx`                         |
| `/tonight`            | "What should I play tonight?": three picks from your shelf for the time, mood and genre you choose | `pages/TonightPage.tsx`                       |
| `/dust`               | Records gathering dust and never played, plus "Pick one for me"                                    | `pages/DustPage.tsx`                          |
| `/stylus`             | Stylus wear meter, "install a new stylus", past styluses                                           | `pages/StylusPage.tsx`                        |
| `/streaming`          | Streaming vs. shelf: albums streamed a lot (Last.fm) but not owned, with vinyl prices              | `pages/StreamingPage.tsx`                     |
| `/discover`           | Recommendations: albums you don't own by artists similar to yours, with the reasons and prices     | `pages/DiscoverPage.tsx`                      |
| `/value`              | What the collection is worth: the total, a chart over time, and records by value                   | `pages/ValuePage.tsx`                         |
| `/wishlist`           | Albums to buy one day, with current prices                                                         | `pages/WishlistPage.tsx`                      |
| `/u/daniel`           | A public profile: shelf, most-played, recent plays (no login needed once it's made public)         | `pages/ProfilePage.tsx`                       |
| `/u/daniel/year/2026` | "Year in records": one year's recap with a chart                                                   | `pages/YearInRecordsPage.tsx`                 |
| `/login`, `/signup`   | Logging in and creating an account (every other page needs a login)                                | `pages/LoginPage.tsx`, `pages/SignupPage.tsx` |
| anything else         | "Not found"                                                                                        | `pages/NotFoundPage.tsx`                      |

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

| File                           | What it does                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `package.json`                 | Names the three workspaces and defines the main commands (`dev`, `test`, `lint`…).                    |
| `package-lock.json`            | The exact version of every installed library, so everyone gets the same ones. Never edit by hand.     |
| `.env`                         | **Your secrets** (the Discogs token). Ignored by Git, so it never goes to GitHub.                     |
| `.env.example`                 | A blank copy of `.env` that _is_ committed, so others know which settings exist.                      |
| `.gitignore`                   | Files Git should never save: `node_modules/`, `.env`, the database, build output.                     |
| `.gitattributes`               | Makes line endings the same on Windows and Linux, so CI doesn't complain.                             |
| `.nvmrc`                       | Which Node.js version this project uses (24).                                                         |
| `tsconfig.base.json`           | TypeScript settings shared by all three folders.                                                      |
| `eslint.config.js`             | Rules for the code checker.                                                                           |
| `.prettierrc.json`             | Formatting preferences (single quotes, semicolons, 100-character lines).                              |
| `.prettierignore`              | Files Prettier should skip.                                                                           |
| `.github/workflows/ci.yml`     | The automatic checks GitHub runs on every push.                                                       |
| `Dockerfile`, `.dockerignore`  | Packs the whole app into one Docker image that any host can run (see `docs/DEPLOY.md`).               |
| `scripts/docker-smoke-test.sh` | Builds the Docker image and checks it really works (run by GitHub on every push).                     |
| `scripts/fetch-demo-data.mjs`  | Fetches the demo albums from Discogs (run once, with a token) and saves them.                         |
| `render.yaml`                  | Tells Render how to run the public demo (free plan, Docker, demo mode, deploy only when checks pass). |
| `docs/DEPLOY.md`               | How the app runs online: the image, its settings, the permanent disk, HTTPS.                          |
| `CLAUDE.md`                    | Project notes for Claude Code (the AI assistant): goals, conventions, milestones.                     |
| `README.md`                    | The project's front page on GitHub: what it is, the live demo link, screenshots, and how to run it.   |
| `docs/screenshots/`            | The pictures shown in the README (taken from the demo).                                               |

### `shared/`: the contracts

| File                     | What it does                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/records.ts`         | **What a record looks like**: the rules for adding or editing one (title required, valid year, condition grades…) and the shape sent back. |
| `src/health.ts`          | The shape of the "are you alive?" answer.                                                                                                  |
| `src/errors.ts`          | The one format every error uses: `{ "error": { "code", "message" } }`.                                                                     |
| `src/discogs.ts`         | What Discogs search results and imports look like, as our server sends them to the website.                                                |
| `src/spins.ts`           | What a track and a logged play ("spin") look like, and the rules for logging one (e.g. no plays in the future).                            |
| `src/stats.ts`           | What the Stats page gets: totals, top artists and records, and genres by month.                                                            |
| `src/dust.ts`            | What the dust report looks like: records gathering dust and never played.                                                                  |
| `src/settings.ts`        | The app's settings (like how many days counts as "dusty") and their defaults.                                                              |
| `src/profiles.ts`        | What a public profile page and a "year in records" look like. Only shareable things: no notes, conditions or stylus.                       |
| `src/ratings.ts`         | Star ratings (half a star to 5, in half steps) and what's sent to rate and review a record.                                                |
| `src/suggestions.ts`     | "What should I play tonight?": what can be asked (time, genre, mood) and what a suggestion looks like.                                     |
| `src/streaming.ts`       | Streaming vs. shelf: the most-streamed albums (each marked as owned, wished for, or neither), vinyl prices, and the wishlist.              |
| `src/recommendations.ts` | What a recommendation looks like: the album, and which of your artists it's similar to.                                                    |
| `src/value.ts`           | The collection's value: the total, how prices moved, a point per day for the chart, and each record's price.                               |
| `src/scrobbling.ts`      | Scrobbling: what can happen to a play meant for Last.fm (sent, waiting, skipped, failed), and whether an account is connected.             |
| `src/styluses.ts`        | What a stylus (turntable needle) looks like, with its wear and status.                                                                     |
| `src/auth.ts`            | What signing up and logging in look like, and the rules for usernames and passwords.                                                       |
| `src/index.ts`           | Re-exports everything so other code can `import { … } from '@vinyl/shared'`.                                                               |

### `server/`: the kitchen

The server is organized in layers. A request flows down through them:

```
request ─▶ app.ts ─▶ routes/ ─▶ services/ ─▶ db/ ─▶ database file
            (which      (check the   (do the real   (tables and
            address?)   input)       work)          connection)
```

| File                                                                       | What it does                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                                             | **Start here.** Reads settings, opens the database, starts listening on port 3001.                                                                                                  |
| `src/app.ts`                                                               | Builds the server and lists every address it answers (`/api/health`, `/api/records`…).                                                                                              |
| `src/config.ts`                                                            | Reads and checks settings from `.env`. The only file allowed to.                                                                                                                    |
| `src/paths.ts`                                                             | Works out where folders are on disk.                                                                                                                                                |
| `src/errors.ts`                                                            | Our error types, e.g. `NotFoundError` becomes a 404.                                                                                                                                |
| `src/middleware/error-handler.ts`                                          | Turns any error into the standard error response.                                                                                                                                   |
| `src/routes/records.ts`                                                    | The record addresses: list, get, add, edit, delete. Short on purpose: check input, call the service, reply.                                                                         |
| `src/services/records.ts`                                                  | **The real work**: searching, sorting, saving and deleting records in the database.                                                                                                 |
| `src/routes/spins.ts`                                                      | The diary addresses: list plays, log a play, delete a play.                                                                                                                         |
| `src/services/spins.ts`                                                    | **The listening diary**: logs a play (which sides, when, how long, which songs) and lists plays newest first.                                                                       |
| `src/services/tracks.ts`                                                   | A record's tracklist: reads it, and saves it from Discogs (keeping one that logged plays depend on).                                                                                |
| `src/routes/stats.ts`                                                      | The Stats address: numbers for a chosen period.                                                                                                                                     |
| `src/services/stats.ts`                                                    | **Adds up the diary**: totals, most-listened artists and records, listening time per genre per month.                                                                               |
| `src/routes/dust.ts`                                                       | The dust report and settings addresses.                                                                                                                                             |
| `src/services/dust.ts`                                                     | **The dust report**: finds records not played in N days, and records never played.                                                                                                  |
| `src/services/settings.ts`                                                 | Reads and saves settings, using defaults for anything not saved yet.                                                                                                                |
| `src/routes/profiles.ts`                                                   | The public profile addresses. The only data addresses that work without logging in.                                                                                                 |
| `src/services/profiles.ts`                                                 | **Public profiles**: builds someone's profile and year recap from their stats, shelf and diary, if they made it public (or it's their own).                                         |
| `src/routes/suggestions.ts`                                                | The "What should I play tonight?" address.                                                                                                                                          |
| `src/services/suggestions.ts`                                              | **Picks tonight's records**: works out what fits the time (the whole record, or some sides), scores each record by dust and rating, and takes the best three.                       |
| `src/routes/streaming.ts`                                                  | The streaming vs. shelf, price and wishlist addresses.                                                                                                                              |
| `src/services/streaming.ts`                                                | **Streaming vs. shelf**: matches streamed albums to the shelf (telling "the same album" from "the same album in another edition"), and looks up the cheapest vinyl copy on Discogs. |
| `src/services/wishlist.ts`                                                 | The wishlist: list, add (never twice), remove.                                                                                                                                      |
| `src/routes/recommendations.ts`                                            | The recommendations address.                                                                                                                                                        |
| `src/services/recommendations.ts`                                          | **Recommendations**: picks the shelf's key artists, asks Last.fm who is similar, and suggests the best-known album of the best matches.                                             |
| `src/routes/value.ts`                                                      | The collection value addresses: read it, and "update prices now".                                                                                                                   |
| `src/services/value.ts`                                                    | **Collection value**: looks up each linked record's price on Discogs about once a day (a few at a time) and adds the saved prices up into a history.                                |
| `src/routes/lastfm.ts`                                                     | The addresses for connecting a Last.fm account: start, come back from Last.fm, status, disconnect.                                                                                  |
| `src/services/scrobbling.ts`                                               | **Scrobbling**: works out which songs a play covered and when each started, and sends them to Last.fm when the play is over.                                                        |
| `src/routes/styluses.ts`                                                   | The stylus addresses: list, install a new one, edit, delete.                                                                                                                        |
| `src/services/styluses.ts`                                                 | **The stylus wear tracker**: adds up the plays logged while each stylus was installed.                                                                                              |
| `src/middleware/password-lock.ts`                                          | **The site password** (online only): the browser asks for it, and wrong guesses are slowed down.                                                                                    |
| `src/middleware/serve-client.ts`                                           | Online, the server also delivers the built website, so only one program runs.                                                                                                       |
| `src/middleware/session.ts`                                                | **Who is logged in**: reads the login cookie, blocks changes sent from other websites.                                                                                              |
| `src/middleware/failure-limiter.ts`                                        | Slows down password guessing (used by logging in and the site password).                                                                                                            |
| `src/routes/auth.ts`                                                       | The account addresses: sign up, log in, log out, "who am I?".                                                                                                                       |
| `src/services/auth.ts`                                                     | **Accounts and login sessions**: creating accounts, checking passwords, starting and ending sessions.                                                                               |
| `src/services/passwords.ts`                                                | Stores passwords safely as scrypt hashes (never the password itself).                                                                                                               |
| `src/routes/discogs.ts`                                                    | The Discogs addresses: search, import a release, link a record to a release.                                                                                                        |
| `src/services/discogs.ts`                                                  | Searches Discogs, imports a release as a new record, or fills in an existing record (cover and empty details only).                                                                 |
| `src/integrations/discogs/client.ts`                                       | **Talks to Discogs.** Sends the token, remembers recent answers, stays under 60 requests a minute.                                                                                  |
| `src/integrations/discogs/mapping.ts`                                      | Converts Discogs data to our format: cleans names, picks the format, adds up track lengths.                                                                                         |
| `src/integrations/discogs/schemas.ts`                                      | The fields we read from Discogs, checked so surprises are caught early.                                                                                                             |
| `src/integrations/discogs/rate-limiter.ts`, `ttl-cache.ts`                 | The 60-a-minute limit and the memory of recent answers.                                                                                                                             |
| `src/integrations/lastfm/client.ts`                                        | **Talks to Last.fm.** Asks for someone's most-streamed albums (only their username is needed) and remembers the answer for an hour.                                                 |
| `src/integrations/lastfm/sample.ts`                                        | A made-up listener's top albums, used by the public demo instead of a real Last.fm account.                                                                                         |
| `src/db/schema.ts`                                                         | **The database tables** and their columns.                                                                                                                                          |
| `src/db/client.ts`                                                         | Opens the database file and makes sure its tables are up to date.                                                                                                                   |
| `src/db/seed.ts`                                                           | Adds 11 sample albums for development.                                                                                                                                              |
| `src/db/demo.ts`                                                           | Fills an empty database with demo data (14 albums, months of plays, a stylus) for the public demo.                                                                                  |
| `src/db/demo-releases.json`                                                | The demo albums' real Discogs details and covers, saved once so the demo never needs Discogs to start.                                                                              |
| `src/db/migrate.ts`                                                        | Applies database updates by hand (the server also does it on start).                                                                                                                |
| `drizzle/`                                                                 | **Migrations**: generated files of instructions that create and update the tables. Committed; never edited by hand.                                                                 |
| `test/`                                                                    | Automatic tests. `helpers.ts` gives each test its own temporary database.                                                                                                           |
| `test/fixtures/discogs/`                                                   | Real Discogs answers saved as files, so tests never contact Discogs or need a token.                                                                                                |
| `test/fixtures/lastfm/`                                                    | Last.fm answers saved as files (most recorded from the real Last.fm, one written by hand in its format), so tests never contact Last.fm or need a key.                              |
| `drizzle.config.ts`, `tsup.config.ts`, `vitest.config.ts`, `tsconfig.json` | Settings for the database tools, the build, the tests and TypeScript.                                                                                                               |

### `client/`: the dining room

The website is organized in layers too:

```
pages/ ─▶ features/collection/ ─▶ api/ ─▶ server
(one per    (pieces of screens:     (talks to
 screen)     cards, form, covers)    the server)
```

| File                                           | What it does                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html`                                   | The single, nearly empty HTML page. React fills it in.                                                                                                                                                       |
| `public/favicon.svg`                           | The little record icon in the browser tab.                                                                                                                                                                   |
| `src/main.tsx`                                 | **Start here.** Plugs React into the page and sets up data fetching and the router.                                                                                                                          |
| `src/App.tsx`                                  | **The list of screens**: which page to show for each address.                                                                                                                                                |
| `src/components/Layout.tsx`                    | The frame around every screen: the header (app name, who's logged in, and the menu in three groups, behind a "Menu" button on phones) and the footer with the server status.                                 |
| `src/components/page-title.ts`                 | The browser tab's title for each page ("Diary · Vinyl Tracker").                                                                                                                                             |
| `src/pages/CollectionPage.tsx`                 | The home screen: a grid of your records with search and sort.                                                                                                                                                |
| `src/pages/RecordDetailPage.tsx`               | One record's page, with Edit and Delete.                                                                                                                                                                     |
| `src/pages/NewRecordPage.tsx`                  | The "Add a record" screen.                                                                                                                                                                                   |
| `src/pages/EditRecordPage.tsx`                 | The "Edit record" screen.                                                                                                                                                                                    |
| `src/pages/DiscogsPage.tsx`                    | Search Discogs. "Add to collection" imports a release; in link mode, "Use this release" fills in an existing record.                                                                                         |
| `src/pages/DiaryPage.tsx`                      | The listening diary: every logged play, grouped by day.                                                                                                                                                      |
| `src/pages/StatsPage.tsx`                      | The Stats page: pick a period, see totals, top 10 lists and the genre chart. Loaded lazily (see below).                                                                                                      |
| `src/pages/TonightPage.tsx`                    | **What should I play tonight?**: the time, mood and genre buttons, the three picks, and Shuffle.                                                                                                             |
| `src/pages/StreamingPage.tsx`                  | **Streaming vs. shelf**: asks for a Last.fm username, then lists streamed albums that aren't on the shelf (with prices and "+ Wishlist"), ones owned in a different edition, and ones that are on the shelf. |
| `src/pages/DiscoverPage.tsx`                   | **Discover**: the recommended albums, each with "Because you own...", a price and "+ Wishlist".                                                                                                              |
| `src/pages/ValuePage.tsx`                      | **Collection value**: the total, how prices moved, the chart, records by value, and "Update prices now". Loaded lazily, like Stats.                                                                          |
| `src/pages/WishlistPage.tsx`                   | **The wishlist**: each album with why it's there, its price, a Discogs link and Remove.                                                                                                                      |
| `src/pages/ProfilePage.tsx`                    | **A public profile**: totals, links to each year, most-played records and artists, recent plays and the shelf. "No profile here" for private or missing ones.                                                |
| `src/pages/YearInRecordsPage.tsx`              | **Year in records**: record and artist of the year, busiest month, a chart by month, top records, artists and genres. Loaded lazily, like Stats.                                                             |
| `src/pages/DustPage.tsx`                       | The dust report: forgotten records, the days setting, and "Pick one for me".                                                                                                                                 |
| `src/pages/StylusPage.tsx`                     | The stylus wear tracker: the stylus in use, its meter and estimate, and past styluses.                                                                                                                       |
| `src/pages/LoginPage.tsx`                      | Logging in (and "Try the demo" on the demo site).                                                                                                                                                            |
| `src/pages/SignupPage.tsx`                     | Creating an account.                                                                                                                                                                                         |
| `src/pages/NotFoundPage.tsx`                   | Shown for addresses (or records) that don't exist.                                                                                                                                                           |
| `src/features/discogs/DiscogsResult.tsx`       | One release in the Discogs results: thumbnail, details, and a button.                                                                                                                                        |
| `src/features/spins/RecordPlays.tsx`           | The listening part of a record's page: play count, "Log a play", its plays and its tracklist.                                                                                                                |
| `src/features/spins/LogSpinPanel.tsx`          | **The "Log a play" panel**: tick sides, choose when, and the length fills itself in.                                                                                                                         |
| `src/features/spins/SpinList.tsx`              | A list of plays (used on the Diary page and on record pages), with delete buttons.                                                                                                                           |
| `src/features/spins/Tracklist.tsx`             | A record's songs, grouped by side, with lengths.                                                                                                                                                             |
| `src/features/spins/sides.ts`                  | Groups tracks by side, adds up side lengths, and writes "Sides A & C".                                                                                                                                       |
| `src/features/spins/dates.ts`                  | Shows times in your local time zone ("7:30 PM", "Monday, October 6").                                                                                                                                        |
| `src/features/stats/GenresByMonth.tsx`         | **The genre chart** (stacked columns per month, a hover box, and "Show as table"). Drawn with Recharts.                                                                                                      |
| `src/features/stats/chart-colors.ts`           | The chart's colors, checked to be colorblind-safe in light and dark mode. A genre keeps its color when you switch periods.                                                                                   |
| `src/features/stats/RankedBars.tsx`            | A top-10 list with a bar for each entry and the numbers at the end of the bar.                                                                                                                               |
| `src/features/stats/StatTiles.tsx`             | The row of big numbers (plays, hours, records, artists).                                                                                                                                                     |
| `src/features/tonight/SuggestionCard.tsx`      | One suggested record: what to put on, why, and a button that logs the play in one click.                                                                                                                     |
| `src/features/auth/AppIntro.tsx`               | The short "what is this app?" introduction beside the login form.                                                                                                                                            |
| `src/features/tonight/reasons.ts`              | Turns the facts about a pick into lines like "Last played 4 months ago".                                                                                                                                     |
| `src/features/streaming/PriceTag.tsx`          | Shows an album's cheapest vinyl price. The first few on a page look it up by themselves; the rest wait for "Check price".                                                                                    |
| `src/features/streaming/LastfmConnect.tsx`     | The box for entering, changing or disconnecting the Last.fm username.                                                                                                                                        |
| `src/features/streaming/format.ts`             | Words and numbers: "Streamed 412 times", prices, the Discogs search link.                                                                                                                                    |
| `src/features/value/ValueChart.tsx`            | The "value over time" line chart, with a hover box and "Show as table".                                                                                                                                      |
| `src/features/value/format.ts`                 | Words for days and price changes ("up $6.00", "15%").                                                                                                                                                        |
| `src/features/scrobbling/ScrobblingCard.tsx`   | The box on the Streaming page for connecting Last.fm (or stopping).                                                                                                                                          |
| `src/features/spins/scrobble-label.ts`         | The words shown in the diary for each play's scrobble: "Scrobbled", "Scrobbles when it ends"...                                                                                                              |
| `src/features/profiles/ProfileHeader.tsx`      | The top of a profile: name, "collecting since", the Share button (copies the link) and, for the owner, the Public profile switch.                                                                            |
| `src/features/profiles/Shelf.tsx`              | Someone's records as a grid of covers (read-only).                                                                                                                                                           |
| `src/features/profiles/RecentPlays.tsx`        | The latest plays on a profile, without notes or delete buttons.                                                                                                                                              |
| `src/features/profiles/MonthChart.tsx`         | The "listening by month" chart on the year page, with a hover box and "Show as table".                                                                                                                       |
| `src/features/profiles/year.ts`                | Finds the busiest month.                                                                                                                                                                                     |
| `src/features/profiles/Reviews.tsx`            | The "Highest rated" and "Reviews" sections of a profile.                                                                                                                                                     |
| `src/features/ratings/Stars.tsx`               | Shows a star rating (read-only): grey stars with colored ones on top, cut off at the rating.                                                                                                                 |
| `src/features/ratings/StarRating.tsx`          | The clickable stars: each star has two halves, and underneath they're ten ordinary radio buttons so the keyboard works too.                                                                                  |
| `src/features/ratings/RecordReview.tsx`        | The "Your rating" box on a record's page: stars save on click, the review has its own Save button.                                                                                                           |
| `src/features/ratings/RatingSpread.tsx`        | The "Your ratings" card on the Stats page: how many records got each rating.                                                                                                                                 |
| `src/features/ratings/format.ts`               | Words for ratings ("4.5 stars").                                                                                                                                                                             |
| `src/features/stats/format.ts`                 | Writes times like "12.5 h" and "1 h 05 min", and months like "Oct".                                                                                                                                          |
| `src/features/dust/DustGrid.tsx`               | A grid of forgotten records, each saying "Last played 4 months ago" or "Added 2 years ago".                                                                                                                  |
| `src/features/dust/time-ago.ts`                | Turns a number of days into words like "4 months ago".                                                                                                                                                       |
| `src/features/stylus/StylusMeter.tsx`          | The wear meter: a bar that turns amber then red, with the status in words and an icon.                                                                                                                       |
| `src/features/stylus/StylusForm.tsx`           | The form for adding or editing a stylus.                                                                                                                                                                     |
| `src/features/stylus/StylusBanner.tsx`         | The warning across the top of every page when the stylus is getting worn. The × hides it until the site is opened again (or the stylus gets worse).                                                          |
| `src/features/stylus/status.ts`                | The icon and words for each status ("⚠ Replace soon"), and hours formatting.                                                                                                                                 |
| `src/features/auth/guards.tsx`                 | Which pages need a login, and sending people to log in first.                                                                                                                                                |
| `src/features/auth/next.ts`                    | Makes sure "go back to where you were" after logging in only goes to pages on this site.                                                                                                                     |
| `src/features/collection/RecordForm.tsx`       | **The add/edit form**: every field, the problem messages, and the Save button.                                                                                                                               |
| `src/features/collection/form-values.ts`       | Converts between what you type ("42:49") and what the server wants (2569 seconds), and checks it.                                                                                                            |
| `src/features/collection/TagInput.tsx`         | The box for genres and styles: type, press Enter, get a chip with an ×.                                                                                                                                      |
| `src/features/collection/RecordCard.tsx`       | One record in the grid.                                                                                                                                                                                      |
| `src/features/collection/RecordCover.tsx`      | The cover picture, or a drawn vinyl disc when there isn't one.                                                                                                                                               |
| `src/features/collection/format.ts`            | Turns data into text: artist lists, lengths ("42:49"), condition names ("Very Good Plus").                                                                                                                   |
| `src/features/collection/useRecordId.ts`       | Reads the record number from the address (`/records/5` gives 5).                                                                                                                                             |
| `src/features/collection/useDebouncedValue.ts` | Waits until you stop typing before searching.                                                                                                                                                                |
| `src/api/client.ts`                            | The one place the website sends requests to the server, plus friendly error messages.                                                                                                                        |
| `src/api/records.ts`                           | Hooks for records: `useRecords`, `useRecord`, `useCreateRecord`, `useUpdateRecord`, `useDeleteRecord`.                                                                                                       |
| `src/api/discogs.ts`                           | Hooks for Discogs: `useDiscogsSearch`, `useImportRelease`, `useLinkRecord`. They only talk to our server.                                                                                                    |
| `src/api/spins.ts`                             | Hooks for the diary: `useTracks`, `useSpins`, `useLogSpin`, `useDeleteSpin`.                                                                                                                                 |
| `src/api/stats.ts`                             | `useStats(period)`: turns "this year" into an exact start time in your time zone and fetches the numbers.                                                                                                    |
| `src/api/suggestions.ts`                       | `useSuggestions(ask)`: fetches the picks for a time, genre and mood.                                                                                                                                         |
| `src/api/streaming.ts`                         | Hooks for streaming vs. shelf, prices, and the wishlist (list, add, remove).                                                                                                                                 |
| `src/api/recommendations.ts`                   | `useRecommendations()`: fetches the suggestions.                                                                                                                                                             |
| `src/api/value.ts`                             | `useCollectionValue()` and `useRefreshPrices()` ("Update prices now").                                                                                                                                       |
| `src/api/scrobbling.ts`                        | `useScrobblingStatus()` and `useDisconnectLastfm()`, plus the address the browser visits to connect.                                                                                                         |
| `src/api/profiles.ts`                          | `useProfile` and `useYearInRecords`: fetch a public profile or a year recap, in your time zone.                                                                                                              |
| `src/api/dust.ts`                              | Hooks for the dust report and settings: `useDustReport`, `useSettings`, `useUpdateSettings`.                                                                                                                 |
| `src/api/styluses.ts`                          | Hooks for styluses: `useStyluses`, `useActiveStylus`, `useAddStylus`, `useUpdateStylus`, `useDeleteStylus`.                                                                                                  |
| `src/api/auth.ts`                              | Hooks for accounts: `useMe`, `useLogin`, `useSignup`, `useDemoLogin`, `useLogout`.                                                                                                                           |
| `src/api/query-client.ts`                      | Sets up TanStack Query, and sends you to the login page if your login expires.                                                                                                                               |
| `src/api/health.ts`                            | A hook (`useHealth`) for the server status shown in the footer.                                                                                                                                              |
| `src/index.css`                                | How everything looks, including light and dark mode.                                                                                                                                                         |
| `src/test/fake-api.ts`                         | A pretend server for tests, plus `makeRecord()` for sample data.                                                                                                                                             |
| `src/test/render.tsx`                          | Draws the whole app in a test, starting at any address.                                                                                                                                                      |
| `src/test/setup.ts`                            | Runs before website tests.                                                                                                                                                                                   |
| `*.test.ts`, `*.test.tsx`                      | Tests, next to the file they test.                                                                                                                                                                           |
| `vite.config.ts`                               | Settings for Vite, including forwarding `/api` requests to the server.                                                                                                                                       |

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

### `e2e/`: tests that use the whole app like a person

"End-to-end" (e2e) tests start everything (a fake Discogs, the real server on a fresh empty database, and the real website) and then drive a real Chrome browser through it: typing, clicking, checking what appears. Run them with `npm run test:e2e`. Your own records are never touched.

| File                        | What it does                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `playwright.config.ts`      | Settings: which three programs to start (and on which ports), and the browser to use.                     |
| `support/fake-discogs.mjs`  | A pretend Discogs that answers with real saved Discogs data, so tests need no token or internet.          |
| `support/start-server.mjs`  | Starts the real server on a brand-new database (`e2e/.tmp/e2e.db`).                                       |
| `tests/fixtures.ts`         | Shared shortcuts, like adding a record or importing Kind of Blue through the API.                         |
| `tests/collection.spec.ts`  | Add a record by hand, find it, edit it, delete it; and the form's error messages.                         |
| `tests/discogs.spec.ts`     | Search Discogs, add a pressing, and check its tracklist.                                                  |
| `tests/diary.spec.ts`       | Log side A, then see it in the Diary and Stats, then delete it.                                           |
| `tests/vinyl-tools.spec.ts` | The dust report and the stylus warning (including hiding it with ×).                                      |
| `tests/profile.spec.ts`     | Make a profile public, then see it (and its year) as a visitor in another browser; make it private again. |
| `tests/ratings.spec.ts`     | Rate and review a record, then see the stars in the collection and the review on the profile.             |
| `tests/tonight.spec.ts`     | Ask what to play with different amounts of time, then log a pick in one click.                            |
| `tests/streaming.spec.ts`   | Connect a Last.fm username, see what's missing with a price, add it to the wishlist and remove it.        |
| `tests/discover.spec.ts`    | Get recommendations from the shelf and add one to the wishlist.                                           |
| `tests/value.spec.ts`       | Look prices up and see the collection's value, with a hand-added record left out.                         |
| `tests/scrobbling.spec.ts`  | Connect Last.fm, log a play and check its songs arrived, then stop scrobbling.                            |

### How accounts keep everyone's data separate

1. When you sign up or log in, the server checks your password and hands your browser a login cookie.
2. Every request after that carries the cookie, so the server knows who's asking (`middleware/session.ts`).
3. Every record and stylus belongs to one account, and every part of the server only looks at **your** things. Asking for someone else's record number answers "not found", as if it didn't exist.
4. Plays and tracklists belong to whoever owns their record, so they're covered too. `test/isolation.test.ts` checks all of this with two accounts trying to reach each other's data.

### How ratings and reviews work

1. A **record** has one star rating and one written review: your overall opinion. Click the stars on its page and they save straight away; the review has its own Save button. They're saved through their own address (`PUT /api/records/5/review`), so editing a record's details can never wipe them.
2. A **play** in the diary can have its own stars ("how was this listen?"), picked when logging it.
3. **Reviews can be shared, notes can't**: ratings and reviews appear on the public profile when it's turned on; notes on records and plays never do.
4. Nothing is worked out ahead of time: "highest rated", the average and the spread on the Stats page are all computed from the saved ratings when asked.

### How "What should I play tonight?" picks

1. You say how much time you have, a genre and a mood (all optional).
2. The server goes through **your own** records. One is dropped if it has the wrong genre, or if nothing on it fits the time. For time it tries the whole record first, then the longest run of sides in a row that fits ("sides A and B").
3. Every record left gets a score from two things only this app knows: **dust** (how long since its last play) and **your rating**. The mood decides which counts more. Something played in the last two days goes to the bottom.
4. The best three are shown, avoiding two by the same artist. Nothing is random, so the same question gives the same answer; "Shuffle" asks again, leaving out the ones already shown.

### How streaming vs. shelf works

1. You give your **Last.fm username** (no password: Last.fm's "top albums" are public). The server asks Last.fm for your most-streamed albums, using an API key that never leaves the server.
2. Each album is compared with your shelf, with names boiled down first (no capitals, accents or punctuation). Only the **same edition** counts as owned. If you own "Rumours" and streamed "Rumours (Super Deluxe)", it goes in its own group, "You own a different edition", with its price and wishlist button, because a collector may want both.
3. For albums you don't own, the server asks **Discogs** for the top three vinyl pressings and shows the cheapest one that has copies for sale. Only the first few albums look this up by themselves; the rest wait for "Check price", to stay under Discogs' limit.
4. "+ Wishlist" saves the album to your wishlist. Adding the same album twice never makes a duplicate.
5. The public demo has no real Last.fm account, so it uses a made-up listener and says so. The prices are still real.

### How scrobbling works

"Scrobbling" is Last.fm's word for adding a played song to your listening history.

1. **Connecting.** "Connect to Last.fm" sends your browser to Last.fm, where you approve the app. Last.fm sends the browser back with a one-time token, which the server swaps for a lasting **session key** and saves (`lastfm_accounts`). The key never reaches the browser. A random "state" value in a short-lived cookie makes sure the browser that comes back is the one that left, so nobody can trick you into connecting their Last.fm to your account.
2. **Signing.** Requests that act on your Last.fm account carry a fingerprint made from the request plus the app's shared secret. That proves to Last.fm they come from this app (`integrations/lastfm/client.ts`).
3. **Logging a play.** If you're connected (and didn't untick the box), the play is marked `pending`. Its songs are the tracks on the sides you played; each one's start time is the play's start plus the lengths of the songs before it.
4. **Sending.** A play that's already over is sent straight away. One that's "starting now" waits: a timer checks every two minutes and sends plays once they've ended, because Last.fm only accepts plays that have happened.
5. **Afterwards** the play is `sent`, `skipped` (no tracklist, or older than two weeks, which Last.fm refuses) or `failed` (you removed the app on Last.fm; the connection is then forgotten here too). A play is never sent twice, and a problem with Last.fm never stops the play itself from being saved.

### How the collection's value is tracked

1. A record's **price** is the cheapest copy of that exact pressing for sale on Discogs. So only records linked to a Discogs release can be priced (imported ones, or ones linked with "Find on Discogs").
2. Every 10 minutes the server (`index.ts`) looks up prices for a few records that haven't been priced in the last 20 hours, and saves each as a **snapshot** in the `price_snapshots` table. Small batches keep it far below Discogs' limit. "Update prices now" does the same on demand, for your own records.
3. The value on any day is worked out from the snapshots: each record counts with its most recent price up to that day. Nothing is stored as a total.
4. "How prices moved" compares first and latest prices only for records priced on more than one day, so adding a new record doesn't look like the collection gaining value.
5. The demo account has a made-up price history (labelled as a sample) and is never looked up for real.

### How recommendations are made

1. **Key artists.** Every artist on your shelf gets points: for each record of theirs you own, for how much you've played it, and for its star rating. The top six are your key artists.
2. **Similar artists.** The server asks Last.fm which artists are similar to each key artist, and how similar (a number from 0 to 1).
3. **A line per key artist.** Artists you already own are dropped (and near-duplicates like "Miles Davis Quintet"). Each key artist then has its own line of similar artists, best first; someone similar to several of your artists moves up the line.
4. **The album.** For the best matches, Last.fm is asked for the artist's best-known albums. The first proper album you don't own is suggested (not a greatest-hits collection or a single), with the reason: "Because you own Miles Davis and John Coltrane".
5. **Taking turns.** Every key artist gets its best available suggestion before anyone gets a second one. So one favorite can't fill the list, and an artist whose closest matches you already own (or have no album to suggest) still gets the next one down the line.
6. **Editions.** Here, owning any edition of an album counts as owning it: this page is for finding music you don't have.

Last.fm's answers are remembered for a day, so the page is instant after the first visit.

### How public profiles stay private until shared

1. Every account has a profile page at `/u/username`, but it starts **private**: the setting `profilePublic` is off.
2. While it's private, everyone except its owner gets "not found", the same answer as for a username that doesn't exist. So nobody can even tell the account exists.
3. Once its owner turns it on, anyone with the link can see it, without logging in.
4. The server copies only shareable things onto the page (titles, artists, covers, play counts and times). Notes, record conditions and the stylus never leave the server. `test/profiles.test.ts` checks this.

## Words you'll see a lot

- **API**: the list of addresses the server answers, like `GET /api/records`. It's how the website and server talk.
- **Request / response**: the website sends a request ("give me the records") and the server sends back a response (the records).
- **GET / POST / PUT / DELETE**: the type of request: read, create, replace, remove.
- **Status code**: a number on every response. `200` OK, `201` created, `204` done with nothing to send back, `400` your input was wrong, `404` not found, `500` the server has a bug.
- **Component**: a React function that returns part of the page.
- **Hook**: a React function starting with `use` (like `useHealth`) that gives a component data or abilities.
- **State**: a component's own memory (`useState`), like what you've typed into the form so far. When it changes, React redraws.
- **Route**: a pairing of an address (like `/records/:id`) with the screen to show. `:id` is a placeholder for the record number.
- **Stylus**: the needle that rides in the record's groove. It wears down with use; a worn one sounds worse and can damage records.
- **Hash (password)**: a scrambled version of a password that can be checked but not turned back into the password.
- **Session / cookie**: after logging in, the browser keeps a small random "ticket" (a cookie) and sends it with every request, so the server knows who you are.
- **Spin**: one logged play of a record, an entry in the diary.
- **Side**: one side of a vinyl disc (A, B; a double album also has C and D). Track positions like "A1" or "C3" say which side a song is on.
- **End-to-end (e2e) test**: a test that uses the whole app the way a person would, in a real browser.
- **Docker image**: the app packed together with everything it needs to run, so it runs the same way on any computer or host.
- **Production**: the copy of the app running online for real use (as opposed to "development" on your computer).
- **Rate limit**: the most requests a service allows in a period of time. Discogs allows 60 a minute.
- **Cache**: a short-term memory of answers, so the same question isn't asked twice.
- **Lazy loading**: downloading part of the website only when it's needed. The Stats page and its chart library load the first time you open Stats, so other pages start faster.
- **Query / mutation**: in TanStack Query, a query _reads_ data (the record list) and a mutation _changes_ it (add, edit, delete).
- **Schema**: a description of what data must look like, used to check it.
- **Migration**: a file of instructions that changes the database's tables.
- **Commit**: a saved snapshot of the code on your computer. **Push**: uploading commits to GitHub.

## Commands cheat sheet

Run these from the project folder:

| Command                                | What it does                                                        |
| -------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                          | Start the server and website. Open http://localhost:5173.           |
| `npm test`                             | Run all automatic tests.                                            |
| `npm run test:e2e`                     | Run the end-to-end tests (a real browser clicking through the app). |
| `npm run lint`                         | Check code for mistakes.                                            |
| `npm run typecheck`                    | Check TypeScript types.                                             |
| `npm run format`                       | Auto-format all code.                                               |
| `npm run db:seed -w server`            | Add sample albums (only if the database is empty).                  |
| `npm run db:seed -w server -- --reset` | Delete all records, then add the sample albums.                     |
| `npm run db:studio -w server`          | Open a browser tool for looking inside the database.                |

(`-w server` means "run this inside the server workspace".)
