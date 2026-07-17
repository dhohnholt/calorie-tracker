# Calorie Tracker

Local calorie & weight tracker. Log food by telling Claude what you ate in
chat — Claude looks up nutrition info (USDA FoodData Central) and writes it to
a local SQLite database. The dashboard shows a daily calories chart (click a
day to see the meal-by-meal breakdown), a macro donut for today, and a weight
trend chart.

## Stack

- `server/` — Express API + SQLite (`better-sqlite3`), data file at
  `server/data/calorie-tracker.db`
- `client/` — React (Vite) dashboard

## Running it

```bash
npm run install:all   # first time only
npm run dev            # runs server (:3001) and client (:5173) together
```

Open http://localhost:5173.

## Logging food via chat

Just tell Claude what you ate (e.g. "I had two scrambled eggs and a slice of
buttered toast for breakfast"). Claude looks up nutrition via the
`/api/nutrition/search` endpoint (USDA FoodData Central) and saves the entry
with `POST /api/food-entries`. The server must be running (`npm run dev`) for
this to work.

## Configuration

`server/.env`:

- `USDA_API_KEY` — defaults to the public `DEMO_KEY` (rate-limited to ~30
  requests/hour/IP). Get a free key instantly at
  https://fdc.nal.usda.gov/api-key-signup and swap it in for higher limits.
- `PORT` — server port, defaults to 3001.

Calorie goal and weight goal are editable from the gear icon in the app, or
via `PUT /api/settings`.

## Deploying later

The client builds to static files (`npm run build --prefix client`) that the
Express server could serve directly, so this can move to a single deployable
service (Railway, Fly.io, a VPS, etc.) with minimal changes when you're ready.
