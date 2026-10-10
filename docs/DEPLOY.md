# Putting Vinyl Tracker Online

How the app runs in production, and what any host needs.

The public demo runs on **Render's free plan** (set up by `render.yaml`). Render's free services have no permanent disk and sleep after 15 minutes without visitors (waking up takes about a minute), so the demo runs in **demo mode**: every time it starts, it fills itself with 14 sample albums, about 6 months of plays and a stylus (`server/src/db/demo.ts`). Visitors can try anything; it all resets on the next restart.

## Putting the demo on Render (step by step)

You only do this once. After that, every push to `main` that passes GitHub's checks updates the live site by itself.

1. **Make an account** at [render.com](https://render.com) and choose **Sign up with GitHub**, so Render can see your repositories.
2. In the Render dashboard, click **New** → **Blueprint**.
3. **Connect the `vinyl-tracker` repository.** Render finds `render.yaml` and shows the service it will create: `vinyl-tracker`, free plan, Docker.
4. Render asks for **`DISCOGS_TOKEN`** (marked as a secret in `render.yaml`). Paste your Discogs token there. It's stored by Render, never in the code. (If you leave it empty, the demo works but "Add from Discogs" says it's not set up.)
5. Click **Apply** / **Deploy Blueprint**. The first build takes a few minutes.
6. When it says **Live**, open the address Render shows (something like `https://vinyl-tracker-xxxx.onrender.com`). You should see the collection with 14 albums and a "Demo" note at the top.

**Checking it's healthy:** the service's page on Render shows its logs. A good start prints `Demo mode: on (added 14 albums and 57 plays)`.

**If the first visit is slow:** that's the free plan waking up after 15 quiet minutes. It takes about a minute, then it's fast again.

## The short version

The app ships as one **Docker image** (see `Dockerfile`). A host runs that image, gives it a **permanent disk** for the database, and sets a few **settings**. That's all.

```
docker build -t vinyl-tracker .
docker run -p 3000:3000 -v vinyl-data:/data \
  -e APP_PASSWORD="a long password" \
  -e DISCOGS_TOKEN="your token" \
  vinyl-tracker
```

Then open http://localhost:3000. The browser asks for the password; any user name works.

## What the image contains

- **One program** (the server) that answers the website's `/api/...` requests **and** delivers the built website itself. In development, `npm run dev` runs these separately.
- The database **migrations**: the server updates the database's tables by itself when it starts.
- Nothing else: no tests, no build tools, no `.env`, no data.

It runs as an ordinary user (not the all-powerful "root"), and reports its health to Docker every 30 seconds via `GET /api/health`.

## Settings (environment variables)

| Setting              | Needed?              | What it does                                                                                                                                                                                                |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_PASSWORD`       | **Yes, online**      | The site-wide password (at least 8 characters). Until accounts exist (M11), this is what keeps strangers out. Leave it unset only on your own computer.                                                     |
| `DISCOGS_TOKEN`      | For Discogs features | Your Discogs personal access token. Without it, Discogs search and import say "not set up".                                                                                                                 |
| `DISCOGS_USER_AGENT` | Recommended          | Identifies the app to Discogs, e.g. `VinylTracker/0.1 +https://github.com/<you>/vinyl-tracker`.                                                                                                             |
| `DEMO_MODE`          | Demo only            | `true` fills an empty database with sample data on start and shows a "Demo" note. See below.                                                                                                                |
| `TRUST_PROXY`        | On most hosts        | Set to `true` when the host puts a proxy in front of the app (almost all do, to provide HTTPS). It lets the password lock see each visitor's real address. Leave it `false` if the app is reached directly. |
| `PORT`               | Set by the image     | `3000` by default. Some hosts set their own.                                                                                                                                                                |
| `DATABASE_PATH`      | Set by the image     | `/data/vinyl.db`, on the permanent disk.                                                                                                                                                                    |

Keep `APP_PASSWORD` and `DISCOGS_TOKEN` in the host's **secrets** settings, never in the code.

## The permanent disk

The database is a single SQLite file at `/data/vinyl.db`. The host must mount a **persistent volume** at `/data`; without one, every restart or update starts with an empty collection. Back this file up from time to time (it's the whole collection).

## HTTPS is required

The password is sent with every request. Over plain `http://` anyone on the network could read it, so the site must only be used over `https://` (the padlock). Hosts provide this automatically; on your own server, a small proxy like Caddy can get a free certificate.

## Demo mode

`DEMO_MODE=true` (set in `render.yaml`) does two things:

- When the database is empty, it's filled with demo data on start. The albums come from `server/src/db/demo-releases.json`, real Discogs data saved once with `node scripts/fetch-demo-data.mjs` (needs a token in `.env`), so starting never depends on Discogs. The plays are timed relative to the current date, so the demo always looks recent.
- The website shows a "Demo" note under the header.

Without a password, anyone with the link can add, edit or delete things on the demo. That's fine for sample data that resets, but don't set `DEMO_MODE` or skip `APP_PASSWORD` on a copy that holds a real collection.

## How it's checked

On every push, GitHub builds the image and runs `scripts/docker-smoke-test.sh`, which starts it and checks the health check, the password lock, the website, saving a record, and that the record survives a restart.
