# Job On (Home DIY Tracker): project instructions

Mobile-first app that helps homeowners capture household repairs and maintenance by voice and video: hold to record, AI transcribes and produces a structured job card with title, effort, location and priority. "See it, say it, save it." The product has also been called HomeFlow and DIY Home Tracker; the repo and GitHub project are Job On. Personal venture of Richard Kelly through Recurrent Ltd; status to confirm.

## Read first

- `README.md` for the phase-one migration from Replit and how to run locally, in Expo Go, on Render and against Supabase.
- `replit.md` for the system architecture as documented at migration time. Verify against the code before relying on it.
- `design_guidelines.md` for brand and UI rules. The pulsing amber record button is the signature element.

## Facts that matter

- Expo SDK 54 React Native client, Express and TypeScript API, Drizzle, Supabase, hosted on Render. `render.yaml` and `app.json` are the deployment truth.
- The Codex app still registers this project under its old path in Documents. The folder moved to `~/Projects/Job On` in June 2026. Do not move it again.
- GitHub: `richierides/Job-On`.

## Working rules

- Keep Replit leftovers out. If something only exists to satisfy Replit, remove it and say so.
- Richard's voice and attribution rules load from his personal defaults, not from this file.
