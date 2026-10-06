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
3. React draws the `App` component (`client/src/App.tsx`).
4. `App` asks the server "are you alive?" by calling `GET /api/health`.
5. Vite forwards anything starting with `/api` to the server on port 3001.
6. The server answers `{ "status": "ok" }` and the page shows **API: ok**.

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

| File             | What it does                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/records.ts` | **What a record looks like**: the rules for adding or editing one (title required, valid year, condition grades…) and the shape sent back. |
| `src/health.ts`  | The shape of the "are you alive?" answer.                                                                                                  |
| `src/errors.ts`  | The one format every error uses: `{ "error": { "code", "message" } }`.                                                                     |
| `src/index.ts`   | Re-exports everything so other code can `import { … } from '@vinyl/shared'`.                                                               |

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
| `src/db/schema.ts`                                                         | **The database tables** and their columns.                                                                          |
| `src/db/client.ts`                                                         | Opens the database file and makes sure its tables are up to date.                                                   |
| `src/db/seed.ts`                                                           | Adds 11 sample albums for development.                                                                              |
| `src/db/migrate.ts`                                                        | Applies database updates by hand (the server also does it on start).                                                |
| `drizzle/`                                                                 | **Migrations**: generated files of instructions that create and update the tables. Committed; never edited by hand. |
| `test/`                                                                    | Automatic tests. `helpers.ts` gives each test its own temporary database.                                           |
| `drizzle.config.ts`, `tsup.config.ts`, `vitest.config.ts`, `tsconfig.json` | Settings for the database tools, the build, the tests and TypeScript.                                               |

### `client/`: the dining room

| File                | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `index.html`        | The single, nearly empty HTML page. React fills it in.                        |
| `src/main.tsx`      | **Start here.** Plugs React into the page and sets up data fetching.          |
| `src/App.tsx`       | The main screen. Right now: title plus server status. In M3: your collection. |
| `src/api/client.ts` | The one place the website sends requests to the server.                       |
| `src/api/health.ts` | A "hook" (`useHealth`) that components call to get the server status.         |
| `src/index.css`     | How things look.                                                              |
| `src/App.test.tsx`  | Tests for the main screen, using a fake server.                               |
| `src/test/setup.ts` | Runs before website tests.                                                    |
| `vite.config.ts`    | Settings for Vite, including forwarding `/api` requests to the server.        |

## Words you'll see a lot

- **API**: the list of addresses the server answers, like `GET /api/records`. It's how the website and server talk.
- **Request / response**: the website sends a request ("give me the records") and the server sends back a response (the records).
- **GET / POST / PUT / DELETE**: the type of request: read, create, replace, remove.
- **Status code**: a number on every response. `200` OK, `201` created, `204` done with nothing to send back, `400` your input was wrong, `404` not found, `500` the server has a bug.
- **Component**: a React function that returns part of the page.
- **Hook**: a React function starting with `use` (like `useHealth`) that gives a component data or abilities.
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
