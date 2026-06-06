# Home DIY Tracker

Expo SDK 54 mobile app with an Express API. This repository is the phase-one
migration from Replit: keep the current product behavior while making local,
Expo Go, Render, and Supabase setup repeatable.

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
