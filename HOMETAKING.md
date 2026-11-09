# Combined product update, 15 September 2026

See [the combined Hometaking guide](docs/COMBINED-HOMETAKING.md) for the current import, household sync, conversation, native installation and verification status. The earlier milestone notes below are historical where superseded.

# Hometaking: first working pilot

## Native room capture, 12 September 2026

I have added a local Swift RoomPlan module, supported-device and camera checks, guided scanning, persistent review drafts, wall/feature corrections, explicit furniture-retention choices, and reviewed geometry in the existing multi-room storage and planner. Original scans and previous reviewed structures remain separate. Existing rooms, items and reference images are preserved. The browser and unsupported devices use photos and manual measurements. I have not yet validated a physical LiDAR capture.

I use straight wall segments for non-rectangular plans. Unknown sill heights, door swings, radiators, bulkheads and ceiling slopes require review; a slope never creates an angled floor wall. Kept detected furniture is a separate inventory. Legacy 3D Reveal is disabled for reviewed structures until the renderer supports them. No new render was produced. The intended later direction is capture, discussion, automatic explained layout, conversational/direct refinement and Blender from the same saved geometry.

[Native build, schema, storage limits and Arthur acceptance checklist](docs/ROOM-SCANNING.md). Earlier milestone descriptions below are historical.

As of 10 September 2026, I have taken the approved editorial concepts into the existing Expo app. The repository remains at `/Users/richardkelly/Projects/Job On`. The application display name is Hometaking; bundle identifiers, URL scheme and deployment identifiers stay compatible with the existing project.

## Layout before specification, 10 September 2026

I start with a bed, cupboard, wardrobe, sofa, armchair, dining table, desk or coffee table. Preset dimensions are explicitly approximate planning sizes and can be edited. I do not need a product, photograph or confirmed manufacturer dimensions to arrange the room. Later, Specify a product or photo adds the chosen item to the same furniture record. Its identity, position and rotation stay fixed, even when the dimensions change; the plan then reports any fit problems. Unowned basic items do not appear as purchases until a product is specified. Older backups continue to load.

## A guided room journey, 10 September 2026

I now start each room with its brief: who it is for, what it needs to support, how it should feel and any known jobs. The flow continues through room capture, inspiration, basic furniture layout, Reveal and the work plan. The brief remains visible and editable through those stages; initially entered jobs become the same editable work checklist. Changing the brief preserves existing furniture and completed tasks. The current stage is saved so Home can resume the room, and navigation does not consume undo steps. Existing rooms and backups remain compatible.

This connects the manual pilot. It does not claim to infer jobs or generate designs with AI. Room capture still uses manual measurements until the native scanning milestone. New rooms without pictures show their own brief, rather than unrelated example imagery.

## What I can use now

- Home, Ideas, Rooms and Works, with the warm paper, bold typography and vermilion direction from the concepts.
- Multiple rectangular rooms, entered in metres with ceiling height.
- Furniture, rugs, windows, doors and fixed features with dimensions in centimetres. Product URLs, pictures, price and ownership can be stored. Product links open from the shopping list.
- A measured floor plan with dragging, 10 cm movement controls, 90-degree rotation, dimension editing, collision warnings and undo. Oversized pieces retain their dimensions and are flagged.
- Pictures and screenshots with notes and roles, plus a written design brief. No Pinterest or Instagram account connection is required.
- Local task checklists and a shopping list derived from the furniture that is not yet owned. The known-price total explicitly excludes missing prices.
- Local saving, validated JSON backups, confirmed restore and undo of room deletion during the current session.
- A Reveal stage between Layout and Work: a real browser-rendered cutaway, editable wall finishes, specified products and PNG image export. The old DIY interface is no longer linked from the app.

The initial room and the two generated editorial pictures are examples. They are labelled as such. The photographs are not generated from the measured floor plan.

## What I am leaving for subsequent milestones

1. Capture actual room geometry with a native scanning flow, with measurement review and a manual fallback. Irregular walls, openings and ceiling details need a richer room model.
2. Turn uploaded inspiration into a structured design brief and proposed layouts that respect the room dimensions. Keep an explicit distinction between exact dimensions and visual interpretation.
3. Import product pages into reviewable furniture records. Fetching a URL and inferring a shape are separate steps; dimensions must retain their source and confirmation state.
4. Extend the current dimension-driven browser 3D preview into Blender scene generation and more realistic product geometry/materials.
5. Add durable accounts, cloud media storage and synchronisation, then test native devices and prepare distribution.

This pilot does not implement LiDAR scanning, URL extraction, AI image understanding, automatic layout design or Blender export.

## Implementation

`client/hometaking/model.ts` defines versioned, validated room/project data and geometry adapted from Richie's Room Planner. Coordinates are centimetres from the room's top-left corner, with item positions at their centres. Rotation is clockwise. Furniture snaps flush to the measured interior wall, with no hidden clearance. Solid-item overlap checks use a 0.5 cm tolerance. Rugs, windows and doors do not participate in solid-object collision checks. Door swing, height clearance and walking routes are not checked.

`store.tsx` stores the project separately from the existing household session, at `@hometaking/local-pilot/v1`. Writes are serialised; the latest save result controls the status shown in settings. Read failures block edits so unreadable saved data is not silently replaced. There are up to 20 undo snapshots in memory. Clearing site data, changing browser/origin or reinstalling the app does not transfer the project, so export a backup first.

The pilot caps the serialised project at 4 million characters, individual images at 1.5 million characters, and rooms/pieces/pictures/tasks at 50/100/30/200 respectively. Platform storage quotas can be lower and a failed write is reported. Images are embedded in the backup; sample image references resolve to bundled assets. This is an early local-storage model, not the intended production media store.

`HometakingScreen.tsx` implements the four screens; `RoomPlan.tsx` provides the measured editor; `forms.tsx` contains the reviewable editing sheets; `media.ts` handles picture selection and backup transfer. The root navigator opens the new pilot without requiring an API account. Existing DIY routes remain intact.

## Running and checking

```sh
npm install
npm run expo:dev -- --web
npm run check:types
npm run test:rooms
```

For a static preview, use the commands in README.md. The browser check script requires Playwright and a Chromium browser. It accepts `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `HOMETAKING_URL` so it can use an existing local test runtime without altering the application dependencies:

```sh
node scripts/hometaking-browser-check.cjs
```

The browser runner creates an isolated browser profile with synthetic data. It writes screenshots, its result and a test backup under ignored `artifacts/hometaking/`.

Validation completed: 10 model tests, TypeScript, browser flow at 393 × 852, responsive checks at 320/768/1440 px, web export and iOS bundle export. The browser flow covers validation, rotation, arrow movement, dragging, undo, shopping, tasks, image upload, brief editing, reload persistence, backup export/restore and room deletion/undo. No browser console errors were recorded on that flow. See `design-qa.md` for visual evidence.

Physical iOS/Android devices, native photo/share dialogs, the old server-backed DIY flow and deployment have not been exercised in this milestone. Existing Expo patch-version warnings and dependency audit findings still need a separate compatibility/security pass before distribution. The legacy app icon and splash artwork also remain to be replaced.



## Furniture snapping, 10 September 2026

Dragging previews and commits the same snapped position: item centres use a 10 cm grid, and wall positions take priority within 6 cm. Rotated bounds are respected and wall alignment is flush, with no hidden clearance. Oversized items retain their dimensions and remain flagged. Arrow controls retain their precise 10 cm nudges.

## Doors, Reveal and completion, 10 September 2026

The room editor now has a dedicated door form for wall, width, height and offset. The floor plan indicates the opening, door leaf and a dashed inward swing. Explicit doors stay attached to their chosen wall when moved. The swing is a guide, not a verified hinge-direction or clearance simulation. Office chair is available as a basic item; furniture archetypes are retained when a product is specified.

The journey is Brief → Capture → Inspiration → Layout → Reveal → Work. Reveal uses Three.js to render the saved room geometry locally in the browser, including wall openings, windows, furniture positions/rotations and wall finish. Furniture is represented by approximate models within its saved dimensions. Product images are reference images alongside the render; the renderer does not infer actual product shape or materials from photos or links. It is a live cutaway preview, not a photorealistic Blender render or AI-generated design. The current web build supports orbit/zoom and PNG download. The native build states that 3D viewing is available in the web preview.

Specified pieces can be reviewed and edited inside Reveal. Layout issues remain visible there. Work ends with Save and return home, plus a way to revisit Reveal. Links to the previous app have been removed from Work and Settings.

Implementation references: [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) and [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html). The renderer releases its scene geometry, materials, controls and WebGL resources when closed.




## Planner refinement, 11 September 2026

Selected items now expose Remove directly, with existing Undo support. Plan symbols show bed headboards and pillows, seating backs and forward arrows, cabinet fronts and desk drawers. Their local back edge matches the reveal's negative-Z back edge. An explicit nearest-wall action rotates and places the back against that wall; saved layouts are never silently reoriented.

Roadmap: item-linked conversation/design notes, available through a selected-item action on touch and potentially a context menu on desktop. Preserve requests such as “monitor on this desk, wall-mounted” and “corkboard behind this desk” as relationships to stable item IDs, with mounting surface/height and reference images where supplied. Feed these notes into the Blender design brief and reveal, ask for clarification when needed, and distinguish requested, proposed and rendered details. Support tabletop and wall-mounted objects without forcing them into floor footprints. This is planned, not yet implemented. The next rendering milestone remains a convincing Blender render of Arthur's bedroom from the saved brief and layout.

## Local server storage, 11 September 2026

The local preview now runs through `npm run preview:hometaking`. It stores validated project snapshots under `.hometaking-data/<browser-plan-id>/latest.json`, with timestamped revisions alongside. These private files are excluded from Git. Existing browser data migrates on opening the updated preview; subsequent changes save automatically. The browser copy remains available offline, and Settings distinguishes device-only from device-and-server saves. The local server binds only to loopback and rejects cross-origin writes, malformed projects and stale revisions. Atomic latest-file replacement and retained revisions protect recovery. No paid service or cloud account is involved.

The plan identifier lives in browser storage. If only the project copy is missing, the server copy can restore it; clearing all browser storage loses the identifier and currently requires manual recovery from the server files. Shared accounts, multi-device discovery, a conflict-resolution interface and history retention controls remain future work. Server files are directly available to the future Blender workflow; this change does not yet generate a render.

Validation: isolated browser migration preserved exact item data; server recovery, stale-write rejection, invalid data, cross-origin requests and offline fallback passed. TypeScript and lint checked. Never run persistence tests against the user's storage directory.

## Bed-size presets, 11 September 2026

The furniture editor offers UK Single, Small double, Double, King and Super king, plus US Twin/single, Full/double, Queen and King. UK is the default for new beds. These are mattress sizes; choosing one resets width and depth to an explicitly estimated outer footprint (mattress plus 10 cm on each overall dimension). Users can replace that estimate with actual frame measurements. Height, existing position and rotation are preserved. The optional bedSize identifier survives edit, reload, export and server saves; old items remain compatible and are not assigned a guessed size. Custom clears the size label without resetting dimensions. A preset invalidates previously confirmed product dimensions.

Sources: [IKEA UK mattress guide](https://www.ikea.com/gb/en/rooms/bedroom/mattress-size-guide-pub63d34391/) and [Sleep Foundation size guide](https://www.sleepfoundation.org/mattress-sizes). US inch values are converted to centimetres using 2.54 cm per inch. The frame allowance is our planning assumption, not a standard from these sources.

## First Blender study, 11 September 2026

Built an actual editable Blender 4.5.9 scene and two Cycles stills of Arthur’s bedroom from the server snapshot, retaining 420 × 350 × 240 cm and the five recorded item transforms. Local output: `.hometaking-data/renders/arthur/`. Input room.json is retained beside the blend file, with embedded source data and packed artwork. The generator is `scripts/blender/render_room.py`; it is a prototype authored for this room, not yet a general furniture or opening pipeline. In particular, door leaf modelling currently covers Arthur’s north-wall door only. No window or wardrobe was invented.

Proposed details: ceiling lighting, monitor and keyboard, homework notebook, corkboard and pinned notes, Zelda print from the supplied inspiration, textile treatments and oak finish. Furniture is approximate geometry within the saved base dimensions; accessories extend above the desk and are explicitly proposals. The brief calls for clothes storage but no storage footprint has been placed, so it remains unresolved. The scene uses actual camera perspective and materials, without changing room size to make the composition fit.

The local Reveal screen fetches the prepared study only for a plan containing the source room. It shows an earlier-study warning when its geometry, furniture, brief or references differ from the source, and offers full-resolution PNG and Blender file links. Rendering is an agent-run local process, not an on-demand consumer service. Earlier notes describing the browser cutaway alone remain historical implementation context.

## Multiple inspiration images, 11 September 2026

Add pictures now supports multiple selection. A batch adds individual Inspiration entries with independent notes and roles; tap any image to edit it afterwards. Single-image selection still opens the note editor. Product photos remain single-select. Cancellation adds nothing; validation rejects an over-capacity batch without partial insertion (30 pictures per room, 4 MB project limit, existing per-image size/type limits).

## Annotated-reference proposal, 11 September 2026

Created `.hometaking-data/designs/arthur/proposal.html` (plus desk-wall.svg and proposal.jpg) for the requested review before a revised Blender render. Proposal: retain the saved desk and room layout; two 120 × 22 cm shelves at 145/185 cm, oak backing, integrated shelf lights and a reachable headphone rail. Suggested finishes replace terracotta placeholders with graphite, oak and muted blue/linen, retaining the saved slate wall colour. This is proposed, not approved, and has not altered room data or the existing Blender study. Clothes storage remains unresolved. The reference notes explicitly require practical shelving, integrated light and bed/desk separation.

## Corrected plan-based Blender study, 11 September 2026

`arthur-v3` replaces the earlier study in the local Reveal viewer without changing the live plan. Source snapshot is `source-room.json`; the proposed furniture scheme is `design-room.json`. Room remains rectangular, 420 × 350 × 240 cm, with TOP/north door and BOTTOM/south window, as explicitly confirmed by Richard. No angled floor wall is introduced. The unmeasured ceiling slope is deliberately omitted.

Assumptions, not measured facts: centred bottom window 90 × 130 cm with sill 85 cm; radiator 84 × 56 cm beside the top-wall door. Furniture proposal: 100 × 200 cm outer single-bed frame on left, 120 × 60 cm desk on right, ergonomic chair, 80 × 55 cm wardrobe near entry. Shelf lighting, oak slats, headphone rail, swivel monitor arm and clothes storage implement the updated brief. Budget is unconstrained for the study. Photos show existing furniture to remove, not items to preserve.

Generator: `scripts/blender/render_arthur_v3.py`. A plan-only run builds geometry and validates furniture bounds, non-overlap and door/window orientation, writing verification.json and top-down.png. `scripts/blender/render_arthur_views.py` renders the annotated plan and two perspectives from the saved blend. The window/radiator approximations and absent ceiling slope must remain explicit in user-facing descriptions. Render success does not establish construction accuracy or ergonomic clearance certification.

Drafted by Richard Kelly, The MRR Co., in collaboration with ChatGPT (OpenAI).
