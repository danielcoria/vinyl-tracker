# Putting Vinyl Tracker Online

How the app runs in production, and what any host needs. The host itself hasn't been chosen yet; a step-by-step guide for the chosen one will be added here.

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
| `TRUST_PROXY`        | On most hosts        | Set to `true` when the host puts a proxy in front of the app (almost all do, to provide HTTPS). It lets the password lock see each visitor's real address. Leave it `false` if the app is reached directly. |
| `PORT`               | Set by the image     | `3000` by default. Some hosts set their own.                                                                                                                                                                |
| `DATABASE_PATH`      | Set by the image     | `/data/vinyl.db`, on the permanent disk.                                                                                                                                                                    |

Keep `APP_PASSWORD` and `DISCOGS_TOKEN` in the host's **secrets** settings, never in the code.

## The permanent disk

The database is a single SQLite file at `/data/vinyl.db`. The host must mount a **persistent volume** at `/data`; without one, every restart or update starts with an empty collection. Back this file up from time to time (it's the whole collection).

## HTTPS is required

The password is sent with every request. Over plain `http://` anyone on the network could read it, so the site must only be used over `https://` (the padlock). Hosts provide this automatically; on your own server, a small proxy like Caddy can get a free certificate.

## How it's checked

On every push, GitHub builds the image and runs `scripts/docker-smoke-test.sh`, which starts it and checks the health check, the password lock, the website, saving a record, and that the record survives a restart.
