# Hometaking (repository: Job On): project instructions

Mobile-first app that helps homeowners capture household repairs and maintenance by voice and video: hold to record, AI transcribes and produces a structured job card with title, effort, location and priority. "See it, say it, save it." The product has also been called HomeFlow and DIY Home Tracker; the repo and GitHub project are Job On. Personal venture of Richard Kelly through Recurrent Ltd; status to confirm.

## Hometaking pilot, 10 September 2026

Richard renamed the consumer app Hometaking and approved the Wallpaper-inspired concepts. The new `client/hometaking` screens use warm paper, bold grotesk type, vermilion and editorial photography. These supersede the older blue/amber design rules for this flow. The legacy DIY code is retained, but Hometaking no longer links into that interface.

The room flow starts with a brief (audience, purpose, feeling, known jobs), then capture, inspiration, layout, Reveal and work. Preserve that connected journey and its shared brief/tasks.

Read `HOMETAKING.md` for the implemented scope: manually measured rectangular rooms, inspiration pictures, furniture dimensions/links and local work/shopping lists. The native RoomPlan integration is implemented but requires physical-device acceptance testing. Do not present automated product extraction, automated AI design or on-demand Blender rendering as implemented. Preserve the project path. The authorised Hometaking identifier is `com.richardkelly.hometaking`; the previous `com.homefix.ai` installation has separate storage.

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

## Shared agent guidance

Keep `AGENTS.md` and `CLAUDE.md` identical. Whenever project instructions change, update both files in the same change so Codex and Claude follow the same guidance.

## Local plan persistence, 11 September 2026

Run `npm run preview:hometaking` to serve the exported web app with automatic local plan storage. The old Python static server cannot save plans. Browser projects migrate on opening the updated preview; private server copies and revision history live in `.hometaking-data/` (gitignored). Preserve dimensions, positions, rotations, stable item IDs, briefs and references exactly. Never use a test fixture or example room as the user’s actual plan. Server storage is local to this machine, not cloud sync or an account service. Keep offline browser recovery and conflict detection when evolving this into a hosted service.

## Bed sizing

Keep regional mattress size labels separate from overall bed-frame dimensions. UK is the default; Queen is explicitly US. Presets currently add a clearly disclosed, editable 10 cm to mattress width and length as a planning allowance, not a verified product measurement. Preserve `bedSize` in browser storage, server snapshots and exports. Never change room dimensions or silently resize existing furniture when loading a preset catalogue.

## Multiple rooms

Home must visibly list every saved room. Switching or adding a room must preserve all other rooms and their contents. Keep the room switcher explicit throughout the design journey; the active room is not the whole project.

## Blender study, 11 September 2026

Arthur’s bedroom has a prepared Blender/Cycles study under `.hometaking-data/renders/arthur`, built by `scripts/blender/render_room.py` from its saved room.json. Measured room geometry must remain fixed. Richard clarified that furniture layouts are suggestions: preserve the broad arrangement where practical, but propose moves that improve the design. Keep proposed accessories and finishes distinct from measured/specifically purchased items. The app can display this study and flags changes to its source layout/brief; it does not yet run Blender automatically. Never present an earlier render as matching a changed plan. No window is recorded, so none was invented. Clothes storage remains unresolved.

## Inspiration uploads

Allow selecting multiple inspiration images in one picker. Keep each image as a separate idea with its own editable note and role. Preserve single-image product selection. Validate batch capacity before adding images, and do not silently discard excess selections.

## Updated Arthur brief and room photos

Richard confirmed a blank slate: existing furniture in room photos is to be removed. Required furniture is a single bed, small wardrobe, desk and desk chair. One friend can sit on the bed and watch a swivel-arm monitor while Arthur uses the computer. Budget is not a constraint for this concept. Furniture may move, respecting the broad starting structure; dimensions of measured architecture may not. IMG_5755/5754 show a sloping ceiling section, recessed narrow window, traditional cornice, wood-panelled entry door and radiator beside it. Their precise dimensions/positions are not yet measured. A photo-based generated concept must be labelled as such, never as a dimension-verified Blender render. Preserve the source plan and earlier study rather than replacing them with guessed photo geometry.

## Orientation correction, 11 September 2026

Arthur’s plan is rectangular, 420 × 350 cm with nominal height 240 cm. User explicitly confirmed door on TOP (north) wall and window on BOTTOM (south) wall. Do not infer a rotated plan or angled floor wall from photographs. The ceiling slope is unmeasured and deliberately omitted from this corrected study. Window width/offset/sill and radiator position remain provisional. Furniture layouts are proposals, not immutable constraints. The v3 study proposes a single bed, 80 cm wardrobe, 120 cm desk and swivel-monitor setup; preserve the user's live plan separately. Inspect the labelled top-down Blender view before producing perspectives.

## Native room capture, 12 September 2026

Read `docs/ROOM-SCANNING.md` for native build instructions, schema and physical-device acceptance tests. The local Expo module under `modules/hometaking-roomplan` requires a custom iOS build (iOS 16+, supported LiDAR hardware); Expo Go and web use photos/manual measurements. Keep original encoded RoomPlan results separate from reviewed centimetre wall/feature geometry and historical captures. Never apply a scan without measurement, orientation and furniture-retention review. Preserve all other rooms, planned furniture and references. Native recovery remains device-local. Optional household sync is described in `docs/COMBINED-HOMETAKING.md`.

RoomPlan classification confidence is not dimensional accuracy. Ceiling slopes, radiators, bulkheads, sill heights and door swings require review; unknown measurements stay null. Curved walls are retained in the native recovery archive but are not silently flattened. Reviewed structures feed the 2D planner; legacy rectangular Reveal and Blender generation must not masquerade as matching them. No physical LiDAR capture has been validated yet. Arthur's dimensions remain provisional until a reviewed scan is explicitly applied; door TOP, window BOTTOM, all existing furniture going, and ceiling slope separate from the floor outline.

## Combined planner, 15 September 2026

Read `docs/COMBINED-HOMETAKING.md` before changing imports, accounts, sync or conversation. The older Supabase project was restored and its two rooms/30 tasks backed up and copied into separate Hometaking records. The local project has five rooms, including both original and imported Arthur/Miles plans. Never merge them by name or replace the 420 × 350 cm Arthur plan with the imported 270 × 290 cm plan. Imported classifications and unknown heights require review. Source records and local references are preserved.

New edits use version 2, keeping version 1 readable. Household sync uses per-room revisions, private assets, durable device drafts and explicit conflicts. Conversation generates reviewed proposals and cannot alter structure or measured furniture dimensions. The native app has been signed, installed and launched under `com.richardkelly.hometaking`; physical LiDAR capture and signed-in two-device acceptance remain outstanding. No automatic Blender rendering or cloud deployment of the changed Express service is claimed.

## Scanner first, standalone app, 15 September 2026

Richard prioritised native scanning, review and persistent rooms over further Room Planner/Homefix integration. Deliver an installed Hometaking Release build that embeds its JavaScript and works without Expo Go, the Expo development launcher, Metro or a Mac connection. Expo remains an internal framework. Capture and device saving must not require an account or network. Preserve completed imports and all saved data; defer further secondary integration work until physical scan, review, save and relaunch acceptance passes. Use `npm run ios:standalone` with `HOMETAKING_APPLE_TEAM` set for the signed personal-team build. Never uninstall the existing Hometaking app to update it.

## Camera-based room impression, 15 September 2026

Richard has completed a real scan and reported missing ceiling slope/window geometry and no saved 3D view. The priority is now camera-based realistic 3D inspection plus saving, not just RoomPlan recognition. Read `docs/CAMERA-ROOM-CAPTURE.md`. Preserve the original scan and reviewed plan. Camera-textured captures are independent visual evidence; never label them measured architecture, complete or photorealistically accepted without physical tests. The first implementation retains camera/depth/pose evidence and shows coverage gaps rather than inventing missing surfaces. Keep further planner/Homefix integration secondary.
