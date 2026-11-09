# Camera-based inspection update

Richard has now made a physical scan and reported omissions. The next build adds saved 3D inspection and a camera-textured capture path. See [camera capture status and tests](CAMERA-ROOM-CAPTURE.md). Earlier statements that no physical capture has occurred are historical; visual completeness and persistence acceptance remain unverified.

# Standalone scanner priority, 15 September 2026

Richard has prioritised scanning and saving rooms. Further Room Planner/Homefix integration is secondary. The new build uses the Release configuration, embedding the app screens and assets and bypassing the development launcher. It does not require Expo Go, Metro, a Mac connection, an account or internet access for scanning and device saving. Expo remains an internal development framework.

Build on this configured Mac with `HOMETAKING_APPLE_TEAM=Q6CR434Q43 npm run ios:standalone`. The signed app is `/tmp/hometaking-native-build/Build/Products/Release-iphoneos/Hometaking.app`. Install over the existing `com.richardkelly.hometaking` app through Xcode Devices and Simulators; do not uninstall it, as that would remove its device data. This is a locally signed test installation, not an App Store release. Personal-team provisioning expires and requires renewal; inspect the embedded profile for its exact expiry.

For acceptance, open Hometaking directly from its icon. Verify the saved room list, select the intended room, then open Room → Capture. Allow camera access, scan the whole room, finish, and review the measurements and orientation. For Arthur, choose “All existing furniture is going”, keep the door TOP/window BOTTOM and record the ceiling slope separately. Apply only after reviewing. Wait for “Saved on this device”, force-close and reopen the app, and verify the room is still there. Repeat for a second room and check the first remains intact. Test this with Wi-Fi/mobile data off to establish independent device saving. Export a backup after the test.

A successful build or installation does not validate an actual LiDAR scan. Physical scan, review, persistence after relaunch and backup checks remain acceptance gates until observed. Household sharing and conversational layout are optional, require network access, and are not prerequisites for this scanner test.

The standalone Release build succeeded and was installed over the existing Hometaking app on 15 September 2026. Its embedded JavaScript bundle is 5,806,486 bytes. The signing profile expires on 22 September 2026 at 13:10 UTC. The task’s Metro server was stopped before direct launch. Direct launch was refused because the iPhone was locked. Unlock it and tap Hometaking. Actual screen display and physical scanning still require user verification.

The development-build instructions below are historical. Use the standalone command above for this acceptance build.

# Current status, 15 September 2026

The new identifier has been signed, installed and launched on the iPhone. Shared storage and imported plans supersede the local-only notes below. See [the combined guide](COMBINED-HOMETAKING.md). A physical LiDAR capture remains unvalidated.

# Hometaking room capture, 12 September 2026

I have added the first native RoomPlan integration to the existing Expo SDK 54 app. I have kept `/Users/richardkelly/Projects/Job On`, the URL scheme and all existing saved plans. On 15 September Richard authorised changing the app identifier to `com.richardkelly.hometaking`. The old Documents path is obsolete.

## What is implemented

I can open Capture through the Room step or Room options → Edit measurements. A supported native iOS build offers guided RoomPlan capture. Other devices, Expo Go and the browser offer photos and manual measurements. Capture requests camera permission only when started; denial offers Settings and the manual route. Cancellation, background interruption, processing failure and timeout return without applying geometry.

I review the plan before applying it: rotate to the intended top/bottom orientation, correct wall endpoints/heights, add or correct doors, windows, openings, radiators, bulkheads and ceiling slopes, and record unknown measurements. The overview folds wall coordinates away until needed. Splitting/removing wall segments supports a manually corrected non-rectangular outline. A manual rectangular replacement is an explicit button; changing text alone does not replace the scan.

I choose “All existing furniture is going” or select detected objects to retain. Detected furniture remains a separate inventory, never room structure. Kept objects appear as dashed planner constraints with their detected dimensions. They are not verified products and do not enter the shopping list. Existing planned furniture and references are not deleted by either choice. Kept object dimensions are still the original detections; add a measured planning item when specifying a replacement, and adjust the keep choice to avoid counting it twice.

Applying affects only the named room. The original scan and earlier reviewed captures remain separate from the current geometry. Current width/depth are the reviewed wall bounds; height is the recorded ceiling value. Existing furniture keeps its coordinates, dimensions, IDs, bed labels, product links and rotations. The planner shows the actual reviewed wall segments and features and flags furniture beyond concave outlines. Fixed-feature projection footprints extend towards the interior by inference; check their heights and depth. This does not certify clearances or a complete room survey.

## Apple capabilities checked

I checked these Apple sources on 12 September 2026, and the installed iOS 26.5 SDK interfaces:

- [RoomPlan overview](https://developer.apple.com/documentation/roomplan): guided camera/LiDAR capture, parametric room results, and furniture categories.
- [CapturedRoom.Surface](https://developer.apple.com/documentation/roomplan/capturedroom/surface): dimensions, transform, category confidence, curved surfaces and polygon corners. Confidence describes classification, not a measurement accuracy guarantee.
- [RoomCaptureSession.isSupported](https://developer.apple.com/documentation/roomplan/roomcapturesession/issupported): runtime support check, used instead of a hard-coded model list.
- [RoomCaptureViewDelegate](https://developer.apple.com/documentation/roomplan/roomcaptureviewdelegate): processing and presentation callbacks.
- [Expo custom native code](https://docs.expo.dev/workflow/customizing/) and [local modules](https://docs.expo.dev/modules/get-started/): a local Swift Expo module requires a native build, and cannot be added to Expo Go by a JavaScript update.

I import straight wall, door, window and opening dimensions and transforms. I preserve the entire encoded `CapturedRoom`, including additional fields Apple supplies, as `original.raw`. It is the original processed parametric result, not camera footage or the opaque sensor stream. The capture adapter exposes the objects separately. Floor surfaces, polygon corners and other extended fields remain in that original JSON; the planner derives its floor outline from connected wall endpoints.

I do not assume reliable ceiling slope, bulkhead or radiator detection. I leave window sill/base height and door swing unknown rather than invent them from category or transform. The maximum detected wall height is labelled an inferred ceiling height. A slope is a separate feature with endpoint extent, optional measured height/base/projection and notes for its high/low levels. It never introduces an angled floor wall. This milestone does not create a parametric sloping ceiling mesh.

Curved-wall scans are retained in the app's Documents directory but are not converted into straight walls silently. The UI offers manual capture for these. A single closed perimeter is required; multiple disconnected rooms, holes and interior wall networks need a later model extension. Wall joins within 15 cm form an explicitly inferred floor perimeter; mismatches should be corrected in review. The original wall segments are not rounded into a rectangle.

## Storage and coordinate contract

- Existing `version: 1` projects and `@hometaking/local-pilot/v1` remain readable without rewriting room contents. New rooms can have optional `structure` data. Use the updated app when opening new backups; older apps do not understand this field.
- `structure.current.original`: immutable capture payload with IDs, timestamp, original JSON, metre dimensions and column-major ARKit transforms.
- `structure.current.geometry`: reviewed centimetres, screen X right / Y down, plan north at the top. Wall endpoints, fixed-feature endpoints, height/base/projection values, per-element/per-measurement provenance, notes and review flags.
- `geometry.frame`: rotation (radians), rotated-plan origin (centimetres), and inferred floor Y (metres) for mapping original ARKit X/Z coordinates. Plan top is not magnetic north. Scans initially align their longest wall horizontally; the user confirms orientation.
- Evidence is `detected`, `inferred` or `user-confirmed`. Unknown measurements are `null`, never a fabricated zero. An overall review acknowledges remaining unknowns rather than converting all detections into confirmed measurements.
- `structure.history`: earlier reviewed captures, including a snapshot of the pre-scan manual structure. `previousDimensions` keeps the original provisional bounding dimensions. Original legacy fixed-feature item records remain in `room.items` but the reviewed structure supplies the planner's fixed features.
- Device drafts use separate AsyncStorage keys and survive closing/reopening capture. New-room drafts retain a stable room ID. Applying requires review gates and project validation; read failures block overwriting, and over-capacity updates retain the draft.
- iOS writes each successful original scan atomically to `Documents/RoomPlanScans/<UUID>.json` before returning it to JavaScript. This recovery copy also survives a conversion failure. Download the app container through Xcode Devices and Simulators to recover these files if necessary.
- Completed rooms, original scan JSON, histories and photos are included in the existing portable project backup. The existing 4 MB project limit still applies, with explicit rejection rather than data truncation. Maximum 50 rooms, 30 images per room and 20 historical captures per room. Additional originals in the native Documents recovery folder are not included in project export until reviewed/applied.
- Native storage is on that device. It does not automatically merge with the Mac browser. The existing local preview server continues to keep revisions and reject conflicting saves. No account or cloud-sync service has been introduced.

The canonical handoff for a later Blender importer is `geometryForRoom(room)` in `client/hometaking/capture/geometry.ts`. Convert centimetres to metres and use `(x / 100, (room.depth - y) / 100, height / 100)` for Blender XYZ. Use the same wall topology and explicit feature measurements; never rebuild from bounding width/depth or assume an unknown sill/slope. Geometry changes disable the legacy rectangular Reveal for that room. The generic legacy Blender script refuses scanned structures. No render has been generated in this task.

## Build compatibility

I added `plugins/with-roomplan-build.js` and `scripts/ios/expo-constants.sh` because Expo SDK 54's Constants pod build phase invokes an unquoted absolute path. The generated CocoaPods post-install hook uses a quoted project script, so the existing `Job On` directory works without being renamed. Regenerate with Expo prebuild and run pod install after changing this plugin. The plugin also quotes the React Native bundling script invocation in the Xcode app target. Both fixes are tracked outside the generated `ios` directory.

## Install on a physical device

The first build exhausted this Mac's available disk space. I removed only task-created indexes and duplicate pod downloads, then retried with compiler indexing disabled. Free several GB before attempting a fresh build in a new Xcode build directory.

I need a LiDAR-equipped iPhone or iPad for the actual capture test. This build has an iOS 16 minimum. The runtime support check is the authority even if a device appears on a compatible-model list.

1. Connect and unlock the device, trust this Mac, and enable **Settings → Privacy & Security → Developer Mode** if prompted. Allow the restart it requests.
2. In Xcode, add the Apple account under **Settings → Accounts**. Open `ios/Hometaking.xcworkspace`, choose the Hometaking target, then **Signing & Capabilities**. Select the development team and keep bundle ID `com.richardkelly.hometaking`. If the account cannot provision that ID, stop and resolve ownership instead of changing the app identifier.
3. From Terminal:

   ```sh
   cd '/Users/richardkelly/Projects/Job On'
   npm install
   npx expo prebuild --platform ios --no-install
   # On a fresh Mac, install CocoaPods with: brew install cocoapods
   cd ios
   pod install
   cd ..
   npm run ios:device -- --port 8082
   ```

   Where pods have already been installed by this task, use `npm run ios:device -- --no-install --port 8082`. Select the connected physical device. The first build needs Xcode's signing access. Do not paste signing credentials into chat. Approve any Keychain request locally.
4. Launch the installed **Hometaking** development build, not Expo Go. Keep the Mac and device on the same network and allow Local Network access. If needed, start Metro with `npx expo start --dev-client --port 8082` and open that development server from the installed app.
5. Export a backup from the existing browser project and transfer the JSON to the phone. Use Project settings → Import backup on the phone and review the replacement confirmation. Export anything already on the phone first, because project import replaces that device's project. This task has not copied or replaced either device's data automatically.

## Physical test, Arthur first

### Installation attempt, 15 September 2026

The Mac now has 20 GB free. The paired iPhone 17 Pro Max has Developer Mode enabled, but was not reachable during this attempt. Xcode found Richard Kelly's personal development team. Signing first failed because the legacy Sign in with Apple entitlement is unsupported by a personal team. A temporary build-only empty entitlement file bypassed that requirement without changing the project configuration. Apple then rejected registration of `com.homefix.ai` because it is unavailable to this team. Installation is blocked until the account/team that owns that identifier is available. The identifier and saved data have not been changed, and no app was installed or real scan tested.

- Select Arthur's existing room in the switcher. Verify all rooms and reference images are present before scanning. Export a baseline backup.
- Open Room → Capture. Deny camera access once and verify the Settings/manual options; enable it and retry. On an unsupported phone, verify that scan is disabled and manual capture works.
- Add a photo from the device library, including an HEIC original, and verify the compatible-format picker returns an accepted image. Existing inspiration photos must remain separate.
- Scan the whole room slowly, following Apple's guidance. Finish and wait for processing. Confirm real walls, doors/windows and dimensions appear; a simulator or synthetic fixture is not this test.
- Rotate the review so Arthur's door is TOP and window BOTTOM. Check with a tape measure. The old 420 × 350 cm and nominal 240 cm height remain provisional until reviewed. Record the ceiling slope separately, including high/low levels and extent, plus radiator location, sill height and door swing. Do not infer an angled floor wall from the photos.
- Choose **All existing furniture is going**. Retain the brief: UK single bed, small wardrobe, desk and desk chair; swivel-arm monitor visible to a friend sitting on the bed. Furniture may move. Budget is unconstrained for the concept.
- Close review before applying and verify the live room is unchanged. Reopen and confirm the draft is available. Apply only after checking orientation and measurement review. Wait for the app's saved status.
- Switch to another room and back. Force-close/relaunch the app. Verify dimensions, fixed features, brief, furniture and references. Export a backup and confirm original/current geometry and history are separate. Restore that backup into an isolated test installation before relying on recovery.
- Repeat with a second room and a new scan of Arthur. Verify only the selected room changes and an earlier capture remains in history. Exercise cancellation, background interruption and a poor/incomplete scan.
- Keep a short log of device model, iOS version, date, measured-versus-detected dimensions, missed features and errors. Do not label the native flow production-validated until this physical acceptance test passes.

## Verification completed before device access

- 27 model/capture tests pass, covering rotated/transformed metre-to-centimetre conversion, concave outlines, review gates, original/current separation, history, malformed geometry, kept inventory and legacy backups. One existing private local project passed a read-only round-trip check. No test fixture was written into user storage.
- Isolated mobile-width Chrome checks pass for unsupported-device fallback, decimal measurement entry, review gates, correction/save, reload, cancellation, draft recovery, multiple rooms and stale-draft choice. Furniture and image references remain unchanged. No browser exceptions were reported.
- An isolated local plan server passed geometry round-trip, retained revisions, other-room preservation and conflict/invalid-geometry rejection checks.
- TypeScript, scoped lint, Expo web/iOS bundle export, native module discovery and Swift checks pass. The RoomPlan module and Expo bridge compiled against the iPhone SDK. The full unsigned iPhone Debug build also succeeded with `CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO`, using `/tmp/hometaking-native-build` for derived data. This is a compiled development app, not a signed installation or a tested room scan.
- The Expo Constants script path correction was executed successfully from the actual project path. `AGENTS.md` and `CLAUDE.md` match.
- No physical LiDAR capture, camera permission interaction on device, signing or installation has been tested yet. Simulator and synthetic tests do not establish scan quality.

Re-run the automated checks with `npm run test:rooms`, `npm run check:types`, and the scripts `scripts/hometaking-capture-check.cjs` / `scripts/hometaking-capture-storage-check.ts`. The browser script expects a static export at port 8092 and uses an isolated Chrome session with mocked plan API responses; the storage script starts its own temporary server at port 18192. Neither uses the live plan server.

## Later conversational layout direction

I intend capture → discussion of occupants/purpose/feeling/required furniture → automatic proposed layout with reasons → conversational or direct refinement → Blender from that same saved geometry. The existing brief-first entry remains connected for now. This task does not implement a conversational layout engine, automated furniture selection or rendering. A later proposal should reference stable room, wall and item IDs, respect kept furniture/fixed features, and record why a move improves the room. For Arthur, monitor visibility from the bed is a relationship in the brief, not an assumed geometric fact.

Drafted by Richard Kelly, The MRR Co., in collaboration with ChatGPT (OpenAI).
