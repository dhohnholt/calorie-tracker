# Calorie Tracker

Local calorie & weight tracker. Log food by telling Claude what you ate in
chat — Claude looks up nutrition info (USDA FoodData Central) and writes it to
a local SQLite database. The dashboard shows a daily calories chart (click a
day to see the meal-by-meal breakdown), a macro donut for today, a weight
trend chart, saved recipes, and AI-generated weekly meal plans. An iOS
companion app (Expo/React Native) is under active development in `mobile/`.

## Repository structure

- `server/` — Express API + SQLite (`better-sqlite3`), data file at
  `server/data/calorie-tracker.db`. Owns the USDA and Anthropic API keys —
  nothing else talks to those APIs directly.
- `client/` — React (Vite) web dashboard.
- `mobile/` — Expo/React Native iOS companion app (foundation milestone; see
  below).
- `shared/` — framework-independent JS used by more than one of the above:
  local-date helpers, body-metric and nutrition-scaling calculations, and
  request validation. `client/` re-exports from here; `server/` and `mobile/`
  import it directly.

## Running the server + web client

```bash
npm run install:all   # first time only (installs server, client, mobile)
npm run dev            # runs server (:3001) and client (:5173) together
```

Open http://localhost:5173.

## Running the mobile app

The mobile app talks to the same Express server — no separate backend. Start
the server first (`npm run dev` above, or `npm run dev --prefix server`),
then:

```bash
cd mobile
npm install       # first time only
npm start          # opens the Expo dev tools; press i for iOS Simulator
```

### Pointing the app at your server

The mobile app reads its API base URL from `EXPO_PUBLIC_API_URL`, an
Expo-inlined environment variable. Copy `mobile/.env.example` to `mobile/.env`
and adjust it for how you're running the app:

- **iOS Simulator** — the simulator shares your Mac's network stack, so the
  default (`http://localhost:3001/api`, used automatically if `.env` is
  absent) works with no configuration.
- **Physical iPhone on the same Wi-Fi network** — `localhost` on the phone
  refers to the phone itself, not your Mac, so it will not reach the server.
  Find your Mac's LAN IP address (System Settings → Wi-Fi → Details, or run
  `ipconfig getifaddr en0` in a terminal) and set:

  ```
  EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api
  ```

  replacing `192.168.1.100` with your Mac's actual address. Never commit a
  real `.env` file or a real IP address — only `.env.example` is tracked.

The current Settings tab in the app displays whichever API URL it's
configured to use, which is a quick way to confirm connectivity.

### Foundation milestone scope

The mobile app currently implements: a Today summary (calories, goal,
remaining, protein, pull-to-refresh), a Log screen (USDA search, quantity in
grams/ounces, meal + date, macro preview, recent foods to re-log), and a
Progress screen (latest weight vs. goal, log/replace today's weight, recent
history). Plan and Settings are placeholders for now. No USDA or Anthropic API
key ever ships in the mobile app — all such calls stay server-side, proxied
through the existing `/api/nutrition/search` and `/api/meal-plan/ai` routes.

## Logging food via chat

Just tell Claude what you ate (e.g. "I had two scrambled eggs and a slice of
buttered toast for breakfast"). Claude looks up nutrition via the
`/api/nutrition/search` endpoint (USDA FoodData Central) and saves the entry
with `POST /api/food-entries`. The server must be running (`npm run dev`) for
this to work.

## Configuration

`server/.env` (see `server/.env.example`):

- `USDA_API_KEY` — defaults to the public `DEMO_KEY` (rate-limited to ~30
  requests/hour/IP). Get a free key instantly at
  https://fdc.nal.usda.gov/api-key-signup and swap it in for higher limits.
- `ANTHROPIC_API_KEY` — required for the AI meal-plan generator.
- `PORT` — server port, defaults to 3001.

Calorie goal and weight goal are editable from the gear icon in the app, or
via `PUT /api/settings`.

## Testing

```bash
npm test --prefix shared   # date/body-metric/validation/nutrition-scaling unit tests
npm test --prefix server   # route-level validation & upsert integration tests
```

Both use Node's built-in test runner (`node --test`) — no extra test
framework dependency.

## Deploying later

The client builds to static files (`npm run build --prefix client`) that the
Express server could serve directly, so this can move to a single deployable
service (Railway, Fly.io, a VPS, etc.) with minimal changes when you're ready.
The mobile app is not deployed anywhere yet — it runs via Expo Go / the iOS
Simulator against your local server.
