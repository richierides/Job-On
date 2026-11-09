# Camera-based room inspection, 15 September 2026

Richard completed a physical RoomPlan scan and reported that the app did not show a saved 3D model, one ceiling slope was missing, and the slope/window junction was omitted. This is a real capture attempt, but it is not successful acceptance of complete geometry, saving after relaunch, or visual quality. The original remains on the phone. Direct access to its protected native archive was denied, but both saved device project snapshots were successfully backed up under `.hometaking-backups/2026-09-15/first-physical-scan/`. They include the original scan JSON. The actual five-room snapshot passed an unchanged parse/export round trip. Arthur’s saved capture has four walls, a door, an opening, no recognised window, and an unmeasured ceiling-slope entry. These omissions match the reported concern.

The required starting point is now a realistic 3D impression of the actual room. A simplified recognised floor plan is insufficient. Further planner/Homefix integration remains secondary.

## Implemented approach

The updated native app adds an original RoomPlan 3D viewer in capture review and the room's 3D section. It reconstructs the original recognised walls, windows, doors, openings and furniture from the archived transforms. It is labelled simplified original geometry, not photographs, reviewed architecture or an updated furniture layout.

A second capture mode uses ARKit scene reconstruction and camera images. It makes a camera-textured surface model locally, without a server or account. The capture records up to 64 overlapping camera views, calibration, poses, depth and confidence. Coaching explicitly includes both ceiling slopes and the window junction from several angles. It disables ARKit plane detection for this capture, to avoid deliberate flattening of observed surface detail. It does not rely on RoomPlan labelling a slope as a particular category.

The projection checks each face against the camera frustum and depth, including its vertices. Missing depth, low confidence and foreground occlusion reject a match. Accepted faces select a view by projected image area. Unmatched observed surfaces remain grey; missing mesh remains a hole. This is a first camera-textured reconstruction, not Gaussian splatting, dense multiview photogrammetry, seamless texture blending or a guaranteed photorealistic result. Glass, thin details, low texture, moving objects, lighting changes and occlusion can still cause holes or distortion. Photographs do not certify geometry. No unseen slope/window junction is invented.

The saved viewer has Colour/shape, Inside/orbit and source Photos controls. The source photos can be inspected independently of the mesh. The proportion of textured triangles measures only observed triangles with image matches. It is not room completeness or dimensional accuracy.

## Persistence and boundaries

`room.visualCaptures` stores up to three explicit versions. A new capture never replaces existing geometry or a previous visual capture. The person inspects the model before keeping it with the room. Native recovery originals are written atomically under Documents/VisualRoomScans, even if app storage subsequently rejects a large project. Discarding a preview does not delete that recovery original. Unattached recovery files can be recovered from the app container; portable backups include only captures explicitly kept with a room.

A kept capture contains its model, camera images, poses, intrinsics and depth in chunks no larger than 2 MB. The existing private-asset codec externalises those chunks during optional household sync. Portable project backups contain every chunk. Existing 100 MB project and 60 MB per-visual-capture limits reject oversized records, without truncating them. App updates must preserve the same identifier and must not uninstall the app.

Visual captures have their own ARKit coordinate origin and are explicitly marked independently aligned and quality-unverified. They do not currently align automatically with the reviewed floor plan or supply editable slope geometry. Existing furniture remains in the photographic view even when “All existing furniture is going” is selected. Removing it photorealistically would be a different task. Visual capture bytes are omitted from conversational model requests and the planner's geometry revision. A later reconstruction pipeline can use the retained camera calibration, poses, depth and photos rather than inventing evidence.

## Physical acceptance

1. Update Hometaking in place and open the existing room. Confirm the existing scan, all rooms and references remain present.
2. In measurement review, open **Inspect original scan in 3D**. Confirm it is the original scan and note the missing ceiling regions.
3. In the room's **Your room in 3D** section, choose **Capture camera-textured 3D**. Use even lighting and move slowly around the room. Include the floor, full ceiling and both sides of the window junction. Camera views have a finite capture limit; stop when the display asks you to finish.
4. Choose **Build 3D view**, then **Inspect new 3D capture**. Check photographic appearance, image orientation, camera navigation, shape mode, grey patches and missing surfaces. Compare both slopes and the window junction against source Photos and the actual room. Record faults; do not call quality accepted from a successful build.
5. Keep the capture with the room. Wait for saved status, close and relaunch, then open the same capture. Verify the measured plan and other rooms remain unchanged. Export a backup and restore in an isolated test installation, checking the source photos as well as the model.
6. Repeat offline. Cross-device retrieval remains a separate household acceptance check.

## Verified sources and tests

- [Apple RoomPlan overview](https://developer.apple.com/augmented-reality/roomplan/): camera plus LiDAR produces a parametric recognised room representation.
- [Apple custom ARSession support](https://developer.apple.com/videos/play/wwdc2023/10192/): RoomPlan can be combined with ARKit scene geometry and camera imagery. This first implementation uses separate captures to preserve the established measured scan.
- [Apple reconstructed scene example](https://developer.apple.com/documentation/arkit/visualizing-and-interacting-with-a-reconstructed-scene): mesh reconstruction; plane detection can flatten mesh surfaces.
- [Apple capturedImage](https://developer.apple.com/documentation/arkit/arframe/capturedimage) and [sceneDepth](https://developer.apple.com/documentation/arkit/arframe/scenedepth): camera pixels and measured depth correspondence.

The final standalone Release build with the viewer and camera capture compiled successfully and was installed in place on Richard’s iPhone on 15 September 2026. No app data was replaced or uninstalled. Camera-textured capture, its appearance and persistence after relaunch still require physical acceptance.

Nine native maths checks cover centred/rotated/transformed camera projection, image vertical direction, behind-camera/out-of-frame rejection and depth/confidence mismatch rejection. Forty-two room tests pass, including camera-model chunk restoration, other-room preservation, unchanged dimensions and exclusion from layout prompts. These are automated implementation checks, not evidence of photo quality or successful slope reconstruction.

Drafted by Richard Kelly, The MRR Co., in collaboration with ChatGPT (OpenAI).
