# Hometaking design QA

Date: 10 September 2026.

Scope: the first manual room-planning pilot. This is a functional adaptation of the approved concepts, not a claim that the scanning or 3D screens have been implemented.

## Visual truth and capture

Source directory: `/Users/richardkelly/.codex/visualizations/2026/09/10/01a08b78-7519-7313-a8f2-f3977a421ae8/`.

Sources: `01-home.png`, `02-inspiration.png`, `04-room.png`, `05-furniture.png`, `06-work.png`. Each source is a 1024 × 1536 raster concept containing a phone frame. `03-scan.png` is outside this milestone.

Implementation: `http://127.0.0.1:8081`, compiled Expo web app, captured with an isolated Playwright Chromium profile. Primary CSS viewport and screenshot size: 393 × 852, deviceScaleFactor 1. Native status bars and phone bezels are not recreated in the web application.

Evidence directory: `/Users/richardkelly/Projects/Job On/artifacts/hometaking/`.

| State | Screenshot | Combined comparison |
| --- | --- | --- |
| Example room Home | home.png | comparison-home-final.jpg |
| Example inspiration board | ideas.png | comparison-ideas-final.jpg |
| Example measured room, top of page | room.png | comparison-room-final.jpg |
| Existing example chair, editing sheet | furniture.png | comparison-furniture-final.jpg |
| Example task list | works.png | comparison-works-final.jpg |

The combined comparison files place the actual source and implementation in the same image. Source images are displayed at approximately 0.587× scale and cropped around the phone screen using browser CSS (601 px source width, offsets −105/−57 px into a 393 × 852 region). The original framed comparison is also retained as `comparison-home.png`. Crops are approximate because these are generated phone mockups, not precise screen exports. Remaining status-bar/bezel pixels and different physical aspect ratios are not treated as UI defects. No pixel-perfect fidelity claim is made.

The furniture concept shows a compact product review; the implementation capture shows the longer manual editing sheet. Its confirmation and save controls are reached by scrolling and were exercised in the browser test. The room concept shows a future 3D render; the implementation intentionally shows real measured geometry, labelled Measured plan. These are scope/state differences, not substitutes presented as working 3D.

## Comparison history and fixes

1. Initial Home comparison: P2, next task fell below the fixed navigation at 393 × 852. Reduced the hero height from 270 to 245 and removed redundant helper copy already supplied by the room form. The final Home comparison shows the next task above the navigation.
2. Browser interaction review: P1 accessibility defect, checked task state was visible but absent from the web accessibility tree. Added explicit `aria-checked`, retaining native accessibility state. Added explicit `aria-selected` to tabs. The final browser test checks a completed task after a full reload.
3. Work-screen comparison: P2, the primary Add a task button was partly below the viewport. Reduced image height and vertical gaps. `comparison-works-final.jpg` shows the full action above the persistent navigation.
4. Evidence correction: an early Work capture preceded image decoding and an early Room capture was scrolled down by a test interaction. These were invalid comparison states, not application defects. Recaptured from a fresh profile after images decoded and with the room at the top of the page. The final comparison files contain the settled states.

Focused review used the combined images to inspect the heading/nav type, active icon colour, action labels, dimension fields, checkbox states and the Home/Works lower action regions. Separate zoom crops were unnecessary: the 393 px implementation columns were reviewed at native capture scale. Source and actual photography are different generated assets with the same Victorian room, olive upholstery, rust chair, chrome and stone direction. Icons use Feather; the measured floor plan is interactive data geometry rather than decorative artwork.

## Findings

No remaining P0/P1/P2 findings in the implemented manual pilot.

Typography, warm paper/ink/vermilion colours, rectangular photography and actions follow the selected direction. Navigation remains visible. The Home and Works actions fit at the primary viewport; longer lists and forms scroll. Pictures have explicit inspiration/example context. No control claims scanning, automatic product extraction or 3D generation is available.

Intentional differences: a persistent Hometaking header; manual room creation instead of scanning; a measured 2D editor instead of a Blender scene; an editable picture board instead of automatic image analysis; a longer manual furniture form; local tasks instead of automatic AI task generation. These are documented in `HOMETAKING.md` and the relevant in-app forms/settings.

P3 follow-up: replace the legacy app icon and splash assets, refine the denser inspiration collage once more real pictures are present, optimise bundled photographs and complete native device visual review.

## Validation

- Ten geometry/backup tests passed, including rotation, touching/overlap tolerance, oversized items, resize warnings, data round-trip, invalid input and duplicate IDs.
- TypeScript and focused ESLint passed.
- The complete browser flow passed: room validation, explicit dimension confirmation, rotating, arrow movement, dragging, undo, shopping totals/ownership, task completion, image upload, design brief, reload persistence, JSON download/restore, room deletion and undo.
- Additional viewport checks: 320 × 900, 768 × 900 and 1440 × 900; no horizontal document overflow. Screenshots are saved as `responsive-*.png` and `rooms-*.png`.
- Browser console errors: zero during the completed flow. Machine-readable result: `browser-results.json`.
- Web export and iOS bundle export passed. An iOS bundle is a compile check, not a physical-device test.

Residual gaps: physical devices and native picker/share dialogs, server-backed legacy DIY routes, cloud persistence, scanning and 3D. No deployment was performed. This QA pass applies to the browser-tested manual pilot only.

final result: passed



## Follow-up: layout before specification

Richard's subsequent preview feedback supersedes the product-first furniture concept. The revised sheet starts with eight basic furniture types and explicitly approximate, editable dimensions. The basic add action is directly beneath the dimensions, visible at 393 × 852. Product/photo fields are deferred behind Specify a product or photo. Visual evidence: `artifacts/hometaking/basic-furniture.png`, reviewed after the final change. Typography, spacing, editable dimensions and the primary action remain legible without clipping.

`hometaking-layout-check.cjs` passes: a basic bed is added without confirmed product dimensions, moved and rotated, excluded from purchases, then upgraded to a product. Its ID, position and rotation are preserved while its dimensions change. The product and dimensions survive a reload. The wider browser regression flow also passes. TypeScript, focused lint and the ten existing model tests pass. The web preview has been rebuilt. No new physical-device validation was performed for this follow-up.

Follow-up final result: passed.

## Wall alignment correction

User screenshots exposed a border-box offset plus a hidden 2 cm clearance. The floor is now a borderless coordinate plane, with wall strokes drawn outside it; wall snapping uses zero implicit clearance. Browser tests dragged a 95 × 190 cm piece into all four corners at 0° and 90° and measured the rendered bounds: all eight alignments passed within 0.15 px, without gaps or overlap. Evidence: `artifacts/hometaking/wall-results.json`, `wall-top-left.png`, `wall-bottom-right.png`. Twelve model tests and TypeScript pass. Earlier notes describing the 2 cm clearance are superseded by this correction. Final result: passed.

## Follow-up: brief before furniture

Richard’s process feedback supersedes the separate-screen journey in the original concepts. New rooms begin with audience, purpose, feeling and jobs, then move through capture, inspiration, layout and work. A shared brief and step navigation keep the stages connected. The known jobs carry into the existing work checklist, with no fabricated AI-generated tasks.

Reviewed settled screenshots at 393 × 852: `artifacts/hometaking/brief-first.png`, `guided-ideas.png`, `guided-work.png`. Initial review found a redundant feeling paragraph and unrelated default living-room imagery in a new bedroom; both were removed. The final inspiration screen shows its next-stage action above navigation, and the work screen shows the carried-over jobs. The brief form scrolls to its next action. These are intentional workflow changes rather than a pixel clone of the original concept.

The new journey browser test passes: brief precedes dimensions, back navigation preserves answers, inspiration precedes furniture, jobs transfer, brief edits preserve furniture/completed tasks, and reload resumes the saved stage. The wider browser flow also passes, covering geometry, images, shopping and backups. TypeScript, focused lint and model tests pass. Physical native devices remain untested for this follow-up.

Follow-up final result: passed.

## Doors, Reveal and finishing the plan

The latest user feedback establishes a six-stage flow: Brief, Capture, Inspiration, Layout, Reveal, Work. Doors are now placed on a selected wall, with an opening and inward swing in the plan. Office chair is a retained furniture archetype. Reveal contains a real browser 3D cutaway, selectable wall finishes, specified products and image export. Work returns to the new Home screen; the old app links are removed from Work and Settings.

Reviewed evidence: `artifacts/hometaking/door-plan.png`, `reveal-3d.png`, and the exported `render-export.png`. The actual scene uses the same saved geometry as the floor plan. It deliberately uses approximate furniture models and does not claim photorealistic Blender or image-to-3D output. The original photorealistic concept remains a later rendering goal. A failed geometry test identified a 1–2 mm cabinet seam overhang; it was corrected and the complete suite now passes.

Validation: all 16 model/backup/scene tests pass, TypeScript and focused lint pass, the brief-first journey and full legacy-independent browser regression pass, and the new reveal browser flow passes (door, office chair, real WebGL scene, PNG export, product specification, wall colour, Work → Home, persistence and absence of old-app links). The native bundle exports successfully, with an explicit web-only 3D message on native. Physical devices and photorealistic/Blender rendering remain outside this tested scope.

Follow-up final result: passed for the approximate browser 3D pilot.

## Planner refinement, 11 September 2026

Passed TypeScript, targeted ESLint and all 16 room tests. Isolated mobile-width browser verified direct item removal and Undo, and bed back placement against all four walls with persisted rotations and flush coordinates. Inspected the mobile plan screenshot for headboard, pillow, seating-back and facing-arrow legibility. Rebuilt the local web preview. Item conversation and mounted objects remain roadmap scope.

## Blender proof of concept, 11 September 2026

Actual Blender/Cycles images, not image-generation mockups. Checked initial render, refined stiff bedding and added visible luminous fixtures. Main camera shows bed/headboard and desk; reverse camera covers armchair and door. Source dimensions and item transforms verified in Blender against the immutable room snapshot, with geometry-check.json alongside outputs. No user project writes during UI checks: intercepted every PUT in an isolated browser. Passed prepared-study display, PNG serving and stale-render warning after wall-colour change. Fixed Express's default hidden-directory exclusion for the explicitly whitelisted render files. TypeScript and targeted lint pass.

Quality limit: this is an initial room-specific procedural model with stylised approximate furnishings and proposed accessories, not a catalogue-accurate or fully photorealistic design. Clothes storage remains unplanned. It proves measured plan -> editable Blender -> rendered images -> in-app Reveal; automatic general-purpose scene generation is still future work.

## Corrected rectangular-room study, 11 September 2026

Verified the top-down Blender view before producing perspectives: 420 × 350 cm footprint, north/top door, south/bottom window. Checked all proposed rigid furniture footprints for bounds and overlap. The new scheme has a single bed, desk, office chair and small wardrobe. Window and radiator sizes/offsets remain explicitly provisional; unmeasured ceiling slope omitted. Previous image-generation concept is not the geometry source.

Visual review found and corrected a daylight-emitter reflection in the glass, duvet/mattress intersections and throw/duvet intersections. The viewer now links to a labelled top-down image. Read-only browser QA (all PUTs intercepted) passed study display, PNG response and stale-source warning. TypeScript, lint and diff checks passed. Furniture/material realism remains prototype quality, not a claim of Wallpaper-level photorealism. The user's editable room remains untouched.

Drafted by Richard Kelly, The MRR Co., in collaboration with ChatGPT (OpenAI).
