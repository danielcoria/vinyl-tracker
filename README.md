# Vinyl Tracker

[![CI](https://github.com/danielcoria/vinyl-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/danielcoria/vinyl-tracker/actions/workflows/ci.yml)

**A diary for your record collection: a Letterboxd for physical music.** Streaming services remember everything you play; nothing remembers what goes on the turntable. Vinyl Tracker does. Track the records you own, log what you play one side at a time, rate and review it, and get things only this data can give you: what's gathering dust, how worn your stylus is, what to play tonight, what you stream but don't own, and what the shelf is worth.

### 🔗 Live demo: [vinyl-tracker-qu7q.onrender.com](https://vinyl-tracker-qu7q.onrender.com)

Click **Try the demo** on the login page to open a shared demo account filled with 14 sample albums, about six months of listening, ratings, reviews and a price history, so every page has something to show. Try anything; it resets to the sample data whenever the server restarts. You can also create your own account. To see a public profile without logging in, open [/u/demo](https://vinyl-tracker-qu7q.onrender.com/u/demo).

> **Heads-up:** the demo runs on a free server. After 15 minutes without visitors it sleeps, and the next visit takes about a minute. After that it's fast.

![A tour of the app: the collection, logging a play, tonight's picks, stats, value, streaming vs. shelf, recommendations and a public profile](docs/screenshots/tour.gif)

## What it does

**Your records**

- **Collection.** Search Discogs and add the exact pressing you own in one click (cover, label, catalog number, tracklist, genres), or add records by hand. Search and sort your shelf.
- **Listening diary.** Log each play by side: tick the sides you played (A, B, C…), and the length fills itself in from the tracklist. Every play lands in a diary, grouped by day.
- **Ratings and reviews.** Rate records from half a star to five and write a review; rate individual listens in the diary. Private notes stay private.
- **"What should I play tonight?"** Say how much time there is, a genre and a mood, and get three picks from the shelf with the reasons: "Never played", "Side A fits your 30 minutes". One click logs the play.

**Insights**

- **Stats.** Most-listened artists and records, plus a chart of how your listening moves between genres month by month. Ranked by listening time, so one side counts for less than a whole double album.
- **Collection value over time.** The server looks up what each record sells for on Discogs about once a day and keeps every price, so a chart shows the collection's value over time, how prices have moved, and the records from most to least valuable.
- **Dust report.** Records you haven't played in a while (you choose how long), and ones you've never played. "Pick one for me" opens a random forgotten record.
- **Stylus wear tracker.** Turntable styluses wear out after a few hundred to a thousand-plus hours. Your logged plays add up against the stylus's rated lifespan, and a warning appears when it's time to replace it.

**Finding more**

- **Streaming vs. shelf.** Connect a Last.fm username to see the albums you stream most but don't own on vinyl ("streamed 412 times, from $20.98 on vinyl"), with live Discogs prices. Owning a different edition is shown separately, because collectors may want both.
- **Recommendations.** A Discover page suggests albums by artists similar to the ones on your shelf, weighted by what you own, play and rate most, and explains each one: "Because you own Miles Davis and John Coltrane".
- **Wishlist.** Save albums from either page, with today's vinyl price beside each.

**Sharing**

- **Accounts.** Sign up with a username and password; everyone gets their own private collection, diary, stats and stylus.
- **Public profiles.** Each account has a page at `/u/username` with its shelf, most-played records and artists, reviews, recent plays, and a "year in records" recap for every year. Private until its owner turns it on; notes and record conditions are never shown.

## Screenshots

|                                                                                                     |                                                                                                |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **The collection**                                                                                  | **A record: rating, review, and logging a play by side**                                       |
| ![A grid of album covers with star ratings](docs/screenshots/collection.jpg)                        | ![Kind of Blue with its rating, review and the log-a-play panel](docs/screenshots/record.jpg)  |
| **What should I play tonight?**                                                                     | **Listening stats**                                                                            |
| ![Three picks for 30 minutes, each with reasons](docs/screenshots/tonight.jpg)                      | ![Most-listened artists and records, genres by month, ratings](docs/screenshots/stats.jpg)     |
| **Collection value over time**                                                                      | **Streaming vs. shelf**                                                                        |
| ![The collection's value, a chart over time and records by value](docs/screenshots/value.jpg)       | ![Most-streamed albums not on the shelf, with vinyl prices](docs/screenshots/streaming.jpg)    |
| **Recommendations**                                                                                 | **A public profile**                                                                           |
| ![Recommended albums with the reason for each](docs/screenshots/discover.jpg)                       | ![A public profile: most-played, recent plays, reviews](docs/screenshots/profile.jpg)          |
| **A year in records**                                                                               | **Dust report**                                                                                |
| ![2026 in records: record of the year and listening by month](docs/screenshots/year-in-records.jpg) | ![Records gathering dust and never played](docs/screenshots/dust-report.jpg)                   |
| **Stylus wear**                                                                                     | **On a phone, in dark mode**                                                                   |
| ![The stylus wear meter](docs/screenshots/stylus.jpg)                                               | ![The collection on a phone in dark mode, with the menu open](docs/screenshots/phone-dark.jpg) |

## How it's built

| Part         | Technology                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Website      | React, TypeScript, Vite, React Router, TanStack Query, Recharts                                         |
| Server       | Node.js, Express, TypeScript                                                                            |
| Database     | SQLite (better-sqlite3) with Drizzle ORM and versioned migrations                                       |
| Shared rules | Zod schemas used by both the website and the server, so they always agree on what valid data looks like |
| Outside data | Discogs API (records, covers, tracklists, prices) and Last.fm API (streaming history, similar artists)  |
| Testing      | Vitest, Supertest, React Testing Library, Playwright                                                    |
| Delivery     | Docker, GitHub Actions, Render                                                                          |

```
 Browser ──▶ Website (React) ──/api──▶ Server (Express) ──▶ SQLite database
                                            │
                                            ├──▶ Discogs API   (token stays on the server)
                                            └──▶ Last.fm API   (key stays on the server)
```

A few decisions worth mentioning (more, with diagrams, in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**):

- **Accounts are built in, not bolted on.** Passwords are stored as scrypt hashes; logins use an httpOnly, SameSite cookie; every query is scoped to the logged-in account, and tests check that one account can never read or change another's data.
- **Secrets never reach the browser.** The website only talks to its own server, which talks to Discogs and Last.fm. It stays under Discogs' limit of 60 requests a minute and remembers recent answers.
- **Derived numbers are never stored.** Play counts, "last played", dust status, stylus wear, stats, ratings spread and the collection's value are all worked out from the saved facts when asked, so they can't drift out of sync.
- **Nothing is random where it can be explained.** Tonight's picks and the recommendations are scored by rules you can read, and each one comes with its reasons.
- **Public pages share on purpose, not by accident.** A profile is built by copying only shareable fields, and a private profile answers exactly like one that doesn't exist.
- **Charts are checked for color blindness.** The chart colors were run through a colorblind-safety checker in both light and dark mode, and every chart has a table view.

## Testing and CI

- **440+ unit and integration tests** cover the server (every API route, against a temporary in-memory database) and the website (screens tested the way a person uses them).
- **14 end-to-end tests** drive a real Chrome browser through the whole app: signing up, importing from Discogs, logging a play, rating and reviewing, tonight's picks, the wishlist, recommendations, the collection's value, and making a profile public and viewing it as a visitor. They run against a fake Discogs and Last.fm and a fresh database every time.
- **Outside services are never called in tests.** Discogs and Last.fm answers are saved as files (recorded from the real services), so tests are fast, repeatable and need no keys.
- **On every push, GitHub Actions** runs formatting, lint, type checks, all tests and the build on Node 22 and 24, the end-to-end tests, and builds and smoke-tests the Docker image (including that data survives a restart).
- **The live demo only updates after all of those pass.**

## Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
git clone https://github.com/danielcoria/vinyl-tracker.git
cd vinyl-tracker
npm install
cp .env.example .env            # then add your Discogs token to .env (optional)
npm run db:seed -w server       # optional: some sample records
npm run dev
```

Then open **http://localhost:5173**.

The Discogs token is only needed for "Add from Discogs". You can get one free at [discogs.com/settings/developers](https://www.discogs.com/settings/developers) ("Generate new token"). Everything else works without it.

"Streaming vs. shelf" needs a free Last.fm API key as well: see [Connecting Last.fm](#connecting-lastfm) below. Prices on that page use the Discogs token.

| Command                              | What it does                                        |
| ------------------------------------ | --------------------------------------------------- |
| `npm run dev`                        | Start the website and server, reloading as you edit |
| `npm test`                           | Run the unit and integration tests                  |
| `npm run test:e2e`                   | Run the end-to-end browser tests                    |
| `npm run lint` / `npm run typecheck` | Check the code                                      |
| `npm run build` then `npm start`     | Build and run it the way it runs online             |

## Connecting Last.fm

"Streaming vs. shelf" compares what you stream with what you own, and "Discover" recommends albums; both get their information from Last.fm. There are two separate steps, for two different people:

- **Using the Streaming page** (anyone with an account on the site): enter a Last.fm username. (Discover needs no username: it works from the shelf.)
- **Setting up the server** (whoever runs the site, once): give it a Last.fm API key.

### Using it: connect your Last.fm username

1. **Have a Last.fm account that knows what you listen to.** Last.fm doesn't play music itself; it keeps a history of what you play elsewhere.
   - Create a free account at [last.fm/join](https://www.last.fm/join).
   - Connect your streaming service at [last.fm/settings/applications](https://www.last.fm/settings/applications) (for example "Spotify Scrobbling": click Connect and approve it).
   - From then on, everything you play is added to your Last.fm history. A brand-new account starts empty, so give it a few days of listening before expecting results.
2. **Find your username.** It's the name in your profile's address: `last.fm/user/your_name`.
3. **In Vinyl Tracker, open "Streaming"** in the menu, type the username and click **Compare with my shelf**.

No Last.fm password is ever asked for: the list of someone's most-played albums is public on Last.fm, and the username is all that's needed to read it. To switch accounts or stop, click **Change** next to the username, then **Save** or **Disconnect**.

If the page says the username doesn't exist, check the spelling against your profile's address. If it shows no albums, pick a longer period (a new account has little history).

On the public demo, the "Try the demo" account is connected to a made-up listener (labelled "Sample data"), so the page has something to show.

### Setting it up: give the server a Last.fm API key

This is only for whoever runs the site. The key identifies the app to Last.fm; it isn't tied to anyone's listening.

1. Log in to Last.fm and open [last.fm/api/account/create](https://www.last.fm/api/account/create).
2. Fill in the form:
   - **Application name:** `Vinyl Tracker`
   - **Application description:** a sentence, e.g. "Compares my most-streamed albums with the records I own."
   - **Callback URL:** leave empty
   - **Application homepage:** the site's address (or leave empty)
3. Click Submit. Last.fm shows an **API key** and a **Shared secret**. Only the API key is needed. (Both can be found again later at [last.fm/api/accounts](https://www.last.fm/api/accounts).)
4. **On your computer:** open the `.env` file in the project folder and add a line (no quotes, no spaces):

   ```
   LASTFM_API_KEY=paste-the-api-key-here
   ```

   Stop `npm run dev` (Ctrl+C) and start it again. The server prints `Last.fm: configured` when it has found the key.

5. **On the live site (Render):** open the service's dashboard → **Environment** → **Add Environment Variable**, with the key `LASTFM_API_KEY` and the same value, then save. Render restarts the site by itself.

Like the Discogs token, the key stays on the server: it's never sent to the browser, and `.env` is never committed. Without a key, the page says Last.fm isn't set up (and the demo account still shows its sample data).

## Project layout

```
client/   the website (React)
server/   the server (Express) and the database
shared/   the data rules both sides use
e2e/      end-to-end browser tests
docs/     guides: how it works, the architecture, and how it's deployed
```

New to the code? **[docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)** walks through every part in plain language, **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** explains the design with diagrams, and deployment details are in **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## What's next

- **Scrobbling to Last.fm:** sending vinyl plays logged here to your Last.fm history, so records count alongside streams

## Credits

Record data, cover images and prices come from [Discogs](https://www.discogs.com). Streaming history and similar artists come from [Last.fm](https://www.last.fm).
