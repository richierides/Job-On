> Hometaking now combines native room capture and the earlier Room Planner. Read [the combined product guide](docs/COMBINED-HOMETAKING.md) for preserved plans, accounts, development services and remaining physical-device checks.

# Hometaking

Hometaking is a consumer room-planning app, with an editorial visual direction inspired by Wallpaper. The first working pilot has measured rooms, furniture placement, inspiration pictures, product links, shopping lists and tasks. The guided flow now includes a 3D Reveal stage. The old voice/video DIY interface is no longer linked from Hometaking.

## Room-planning pilot

Run `npm install`, then `npm run expo:dev -- --web`. The Hometaking pilot opens without an account, API key or database. Start with the labelled example room or add your own rectangular room. Pictures are inspiration, not renders of the measured layout.

For a static local preview:

```sh
npx expo export --platform web --output-dir dist-hometaking
npm run preview:hometaking
```

Open http://127.0.0.1:8081. Data is stored on that browser/device and automatically copied to the local preview server in `.hometaking-data/`, with retained revisions. This is local storage, not cloud sync. Project settings provides portable JSON backup and restore. See [HOMETAKING.md](HOMETAKING.md) for the pilot scope, model and next milestones, and [design-qa.md](design-qa.md) for validation.

Native room capture is now implemented for custom iOS builds on supported LiDAR devices, with a photos/manual fallback. Physical-device acceptance testing is still required. Read [installation and testing instructions](docs/ROOM-SCANNING.md) before scanning. Expo Go cannot run RoomPlan.

The sections below describe the existing Express-backed DIY features, which require their own API and database.

## Phase One: Run As Is

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create `.env` from `.env.example` and fill in:
   - `DATABASE_URL`: Supabase Postgres connection string
   - `OPENAI_API_KEY`: OpenAI key for transcription and planning
   - `EXPO_PUBLIC_API_URL`: API URL used by the Expo client

3. Apply the database schema:

   ```sh
   npm run db:push
   ```

4. Start the API:

   ```sh
   npm run server:dev
   ```

5. Start Expo:

   ```sh
   npm run expo:dev
   ```

For physical phones in Expo Go, set `EXPO_PUBLIC_API_URL` to a URL the phone can
reach. The easiest reliable option is a Render URL. For local LAN testing, use
your computer's LAN IP, for example `http://192.168.1.25:5000`.

## Render

`render.yaml` defines the web service. Render needs these secrets:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `ALLOWED_ORIGINS`
- `EXPO_PUBLIC_API_URL`

`Aptfile` installs `ffmpeg`, which the video-to-audio pipeline requires.

## Storage Note

The current app stores uploaded videos and thumbnails under `uploads/` and serves
them through Express. That faithfully matches the Replit app, but Render's local
filesystem is not durable across deploys. Before production use, move permanent
video and thumbnail storage to Supabase Storage and keep `/tmp/uploads` only for
temporary processing.

## Phase Two

After phase one is stable, evolve the product toward flexible areas/goals,
assignable subtasks with notes, household availability, and milestone forecasts.
