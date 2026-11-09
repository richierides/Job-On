# Combined Hometaking, 15 September 2026

I kept the Expo app and editorial interface in `/Users/richardkelly/Projects/Job On`. I adapted the other planner's data and useful behaviour without moving either folder. The technical application identifier is now `com.richardkelly.hometaking`, as Richard authorised. The display name remains Hometaking and the existing URL scheme remains `homediytracker`.

## Current priority

Richard has prioritised a standalone native scanner that reviews and saves rooms. Further integration work is deferred until physical capture and relaunch acceptance passes. See [standalone installation and testing](ROOM-SCANNING.md). Existing imported data and completed integration work remain preserved.

## Preserved plans

I restored Supabase project `heoindeabtttrcshlgrz` (Richie's Room Planner) and recovered two rooms, 15 items and 30 ordered household tasks. Mylnhurst owns those records; the second household has no rooms. Existing users and memberships are unchanged.

The local Hometaking project now contains five separate rooms and 28 items. Its original Living room, Arthur's bedroom and Mile's bedroom, and all eight reference images, exactly match the pre-migration archive. The appended `Arthur's Room` and `Miles' Room` retain their original names, IDs, coordinates, rotations, item types and source records. They are labelled Room Planner imports in the home list. Arthur's imported plan is 270 × 290 cm; it has not replaced the provisional 420 × 350 cm Hometaking bedroom. A source bed classified as a shelf and chair classified as a window remain unchanged and require review.

Private backups are in `.hometaking-backups/2026-09-15/`: the complete local data archive, original Supabase records, checksums, a converted source export and the combined portable backup. Original archive/source files are read-only and gitignored. The working local plan gained a new revision; older revisions and Blender studies remain intact. The two source rooms and 30 tasks are also seeded in separate Hometaking cloud records, leaving the original `rooms` and `tasks` tables unchanged. The three local-only rooms become shared only when the user chooses their destination household.

## Using the combined app

- **Project settings → Import Room Planner rooms and tasks** previews JSON exports. While connected to a household, **Preview original household Room Planner plans** reads its original records. Unchanged imports are skipped; changed rooms/tasks require keep or separate-version choices. Matching names never merge records.
- **Project settings → Household account** provides email/password sign-in, registration, password recovery, household selection/creation and invitation acceptance. Existing Room Planner credentials work against the same Supabase project. Saving an invitation authorises that email; it does not send an email automatically. The invitee signs in and chooses Accept household invitations.
- Opening a household offers a destination preview: open its rooms, or add current device rooms. Colliding IDs with different contents become separate records. Returning to the local project preserves each household's device draft for later recovery.
- **Household work and shopping** keeps tasks ordered, with completion and editable comments. Shopping spans rooms, retaining ownership and prices. Imported comments are historical records, not newly agreed decisions or instructions.
- **Layout → Discuss the layout** sends the brief, reviewed geometry, retained objects and recent conversation to the server. Photos and encoded scan archives are omitted from model requests. Proposals contain actions, reasons and uncertainties, with a separate plan preview. Accept, reject, refine or undo. No conversation operation can resize architecture or existing furniture, alter fixed features or delete references. New overlaps and out-of-bounds placements are rejected; unknown clearances still require measurement.
- Sockets and shelves are supported item types. A selected movable item has a rotated resize handle; exact dimensions remain editable. A recorded hinge enables the door swing; unknown swing is labelled. Unknown room/item heights stay null and disable the rectangular 3D preview.

## Storage and service contract

Version 1 backups remain readable. New edits/imports use version 2, adding household tasks, imported source metadata, optional conversation, sockets/shelves/hinges and nullable heights. Unknown source fields remain in each imported room's original record. Source identity and content fingerprint make repeat imports detectable.

Browser projects use IndexedDB, migrating from the existing AsyncStorage/localStorage key without deleting it. Native projects use alternating files and a small committed-slot pointer, retaining the previous complete file. The portable backup cap is 100 MB, with explicit errors instead of truncation; existing per-room limits remain. A staged `Documents/hometaking-import.json` can initialise a fresh native installation only. Any existing project, even an empty one, takes precedence.

Shared data uses `ht_documents` and append-only `ht_history`. Each room has its own expected revision, with household tasks in a separate document. `ht_save_document` checks authentication and membership, locks the document, compares revisions and writes current/history in one transaction. Direct authenticated table writes are revoked; this intentionally privileged RPC is the sole write boundary. The authenticated-only function has a fixed search path and explicit membership checks. Deletions are tombstones. Independent rooms merge; competing edits to one room require a choice. Undo only changes records touched by that edit, preserving unrelated remote updates.

A durable local project plus its last acknowledged baseline forms the offline queue. Sync runs after saves, on request and every 30 seconds while mounted. The status distinguishes device saving, syncing and household saving. Household/user-specific draft copies survive switching or signing out. Network/session errors retain local data. Supabase policies scope documents, histories and assets by household membership.

Long image/scan strings are externalised into the private `hometaking` bucket by SHA-256 content address. Asset uploads finish before their document commits; failed uploads do not publish partial manifests. Downloads use short-lived signed URLs, verify their checksums and reject cross-household paths. The app hydrates assets locally, so portable exports include the actual images/scan JSON rather than expiring URLs. Interrupted transfers can leave unused immutable assets; automatic deletion is deliberately not performed.

The Express endpoint is `POST /api/hometaking/propose`, authenticated with the Supabase access token. Request: room, message and bounded conversation history. Response: room ID, semantic revision, reply, reasons, uncertainties and proposed actions. Both server and client validate actions against the original room. `HOMETAKING_PLAN_MODEL` defaults to `gpt-4.1-mini`; its availability was verified with the existing server key. Model output is a proposal, never a geometric guarantee. API keys remain on the server. This development milestone does not deploy the changed Express service to Render.

## iPhone and next physical checks

The signed Debug build succeeded and was installed and launched on Richard's iPhone 17 Pro Max. The combined five-room backup was transferred into the new app's Documents folder for first-load recovery. The previous app identifier's container was not changed. Metro is on port 8082 and the Hometaking-only development API on port 5001. The Mac's address during setup was `192.168.4.106`; it may change on another network.

To restart the development services from the project folder:

```sh
npm run dev:hometaking-api
# In another terminal, substitute the Mac's current local IP if necessary:
EXPO_PUBLIC_API_URL=http://192.168.4.106:5001 npx expo start --dev-client --port 8082 --lan
```

Open Hometaking, allow Local Network access, and choose the development server at `http://192.168.4.106:8082` if its launcher appears. The phone and Mac must be on the same network. Keep the Mac running for this development build.

1. Confirm the five-room list and eight original references. Select **Arthur's bedroom**, the existing Hometaking plan, rather than the separately labelled imported Arthur plan.
2. Open Room → Capture, grant camera access and perform a real room scan. Rotate to door TOP/window BOTTOM, check tape measurements and choose **All existing furniture is going**. Record the ceiling slope separately and review sill, radiator and swing information. Apply only after review.
3. Close/relaunch and verify the saved scan. Sign in through Project settings, choose **Mylnhurst**, and use **Add current rooms to Mylnhurst** after reviewing its destination summary to share the local-only rooms.
4. On a second signed-in device, open Mylnhurst and sync. Verify all geometry, original scans and references. Exercise concurrent edits and Keep both versions. Export and restore a backup in an isolated installation.
5. Test an actual conversational request and its acceptance/undo against the saved room. Model accessibility was checked; live authenticated conversation and two-device acceptance still require signed-in user testing.

For native signup/recovery, allow `homediytracker://auth` in Supabase Authentication → URL Configuration, alongside the actual browser URL. Existing password sign-in does not require an email redirect. The native recovery/signup redirect has not yet been confirmed against the project's hosted Auth settings.

`HOMETAKING_PERSONAL_TEAM=1 npx expo prebuild --platform ios --no-install` omits the unused Apple-sign-in entitlement for personal-team builds. The successful build used an equivalent temporary entitlement override. Retain the Constants/path plugin so the folder's space continues to work. Future native-module changes require rebuilding; ordinary TypeScript changes arrive through Metro.

## Verification and limitations

Automated checks cover legacy conversion, exact source preservation, idempotent import, changed-source choices, nullable measurements, source collisions, asset round-trip/corruption/interruption, sync conflicts/deletions/retries, rotated resizing, proposal validation, original scan separation and undo over remote changes. The isolated mobile-width browser check covers account entry, import preview/application, tasks/comments, IndexedDB reload and the signed-out conversation guard. It does not touch real user browser storage.

Live SQL tests run inside rolled-back transactions and verify expected revisions, idempotent retry, history, tombstones, direct-write protection, cross-household denial and missing authentication. Database checks confirm the original source rooms and tasks remain exactly unchanged. TypeScript and scoped lint are checked separately. Scripts are `npm run test:rooms`, `npm run check:types`, `scripts/hometaking-combined-browser-check.cjs` and `supabase/verify-hometaking.sql`.

Supabase's security advisor identifies intentional authenticated SECURITY DEFINER RPCs, including the guarded save boundary. It also reports the pre-existing mutable search path on `touch_updated_at` and disabled leaked-password protection. See the [function warning guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). These are not missing household policies on the new tables.

No real LiDAR capture, authenticated two-device session or physical measurement acceptance has been claimed. No new render was generated. Blender remains a later consumer of the same reviewed geometry.

Drafted by Richard Kelly, The MRR Co., in collaboration with ChatGPT (OpenAI).
