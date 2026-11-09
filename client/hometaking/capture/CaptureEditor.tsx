import React, { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Action, Field, s } from "../ui";
import { Room, newId, ideaSchema } from "../model";
import { pickPictures } from "../media";
import { Capture, captureSchema, Feature } from "./schema";
import {
  applyCapture,
  convertScan,
  extents,
  geometryErrors,
  rectangle,
  rotateCapture,
  geometryForRoom,
} from "./geometry";
import { captureRoom, scanSupport, viewOriginalScan } from "./native";
import { MeasurementField } from "./MeasurementField";
import { GeometryDrawing } from "./GeometryDrawing";

export function CaptureEditor({
  room,
  onSave,
}: {
  room: Room;
  onSave: (r: Room) => boolean;
}) {
  const key = `@hometaking/capture-draft/v1/${room.id}`;
  const [capture, setCapture] = useState<Capture>(
    () =>
      room.structure?.current ?? {
        geometry: geometryForRoom(room),
        furnitureDecision: "undecided",
        keptObjectIds: [],
      },
  );
  const [photos, setPhotos] = useState<Room["ideas"]>([]);
  const [stale, setStale] = useState<{
    capture: Capture;
    photos: Room["ideas"];
  } | null>(null);
  const [showWalls, setShowWalls] = useState(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [support, setSupport] = useState({
    supported: false,
    message: "Checking scanning support…",
  });
  const [width, setWidth] = useState(String(room.width / 100)),
    [depth, setDepth] = useState(String(room.depth / 100));
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void scanSupport()
      .then((v) => {
        if (active) setSupport(v);
      })
      .catch(() => {
        if (active)
          setSupport({
            supported: false,
            message:
              "Scanning support could not be checked. Use manual measurements.",
          });
      });
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          const d = JSON.parse(raw);
          const recovered = {
            capture: captureSchema.parse(d.capture),
            photos: ideaSchema
              .array()
              .max(30)
              .parse(d.photos ?? []),
          };
          if (d.baseUpdatedAt === room.updatedAt) {
            setCapture(recovered.capture);
            setPhotos(recovered.photos);
          } else {
            const state = (c: Capture | undefined) =>
              JSON.stringify(
                c && [c.geometry, c.furnitureDecision, c.keptObjectIds],
              );
            const alreadyApplied =
              state(recovered.capture) === state(room.structure?.current) &&
              recovered.photos.every((photo) =>
                room.ideas.some((i) => i.id === photo.id),
              );
            if (!alreadyApplied) {
              setStale(recovered);
              return;
            }
          }
        }
        setReady(true);
      })
      .catch(() => {
        if (active)
          setError(
            "The saved capture draft could not be read. Close this screen and retry; it has not been overwritten.",
          );
      });
    return () => {
      active = false;
    };
  }, [key, room.updatedAt, room.structure, room.ideas]);
  useEffect(() => {
    if (!ready) return;
    const raw = JSON.stringify({
      capture,
      photos,
      baseUpdatedAt: room.updatedAt,
    });
    queue.current = queue.current
      .then(() => AsyncStorage.setItem(key, raw))
      .catch(() =>
        setError(
          "The review draft could not be saved. Keep this screen open and retry.",
        ),
      );
  }, [capture, photos, key, ready, room.updatedAt]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const g = capture.geometry;
  const edit = (geometry: Capture["geometry"]) =>
    setCapture({
      ...capture,
      geometry: { ...geometry, measurementsReviewed: false },
    });
  const feature = (id: string, changes: Partial<Feature>) =>
    edit({
      ...g,
      features: g.features.map((f) =>
        f.id === id ? { ...f, ...changes, source: "user-confirmed" } : f,
      ),
    });
  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const isArthur = /arthur/i.test(`${room.name} ${room.forWhom}`);
  return (
    <View style={{ gap: 18, width: "100%", minWidth: 0 }}>
      <Text style={s.section}>Capture {room.name}</Text>
      {stale && (
        <View style={{ gap: 12 }}>
          <Text style={s.error}>
            This room changed after the review draft began. The saved room and
            draft are both preserved. Choose which measurements to review.
          </Text>
          <Action
            secondary
            label="Resume draft against the current room"
            onPress={() => {
              setCapture(stale.capture);
              setPhotos(
                stale.photos.filter(
                  (p) => !room.ideas.some((i) => i.id === p.id),
                ),
              );
              setStale(null);
              setReady(true);
            }}
          />
          <Action
            secondary
            label="Discard draft and review saved measurements"
            onPress={() => {
              setStale(null);
              setReady(true);
            }}
          />
        </View>
      )}
      <Text style={s.muted}>{support.message}</Text>
      <Text style={s.body}>
        Move slowly around the room. Include each wall, corner, door and window,
        and follow the camera guidance. Avoid mirrors and keep the room well
        lit.
      </Text>
      <Action
        label="Scan with LiDAR"
        disabled={!ready || busy || !support.supported}
        onPress={() =>
          void run(async () => setCapture(convertScan(await captureRoom())))
        }
      />
      {capture.original && (
        <Action
          secondary
          disabled={busy}
          label="Inspect original scan in 3D"
          onPress={() =>
            void run(async () => {
              await viewOriginalScan(capture.original!.raw);
            })
          }
        />
      )}
      {support.supported && (
        <Action
          secondary
          label="Open camera settings"
          onPress={() =>
            void run(async () => {
              await Linking.openSettings();
            })
          }
        />
      )}
      <Text style={s.section}>Photos and measurements</Text>
      <Text style={s.muted}>
        Use this on any device, or add details the scan missed. Existing
        dimensions are provisional. A ceiling slope is separate from the floor
        outline.
      </Text>
      {isArthur && (
        <Text style={s.body}>
          Arthur’s brief: all existing furniture is going. UK single bed, small
          wardrobe, desk and chair; a swivel-arm monitor visible from the bed.
          Check door at TOP, window at BOTTOM. The 420 × 350 cm room and nominal
          height need verification. Record the ceiling slope separately.
        </Text>
      )}
      <Action
        secondary
        label="Add room photos"
        disabled={busy || !ready}
        onPress={() =>
          void run(async () => {
            const images = await pickPictures(
              30 - room.ideas.length - photos.length,
            );
            setPhotos([
              ...photos,
              ...images.map((image) => ({
                id: newId(),
                image,
                note: "Room capture photo",
                role: "Room photo" as const,
              })),
            ]);
          })
        }
      />
      <Text style={s.muted}>
        {photos.length} new room photos. Existing references are preserved.
      </Text>
      <MeasurementField
        label="Width (metres)"
        value={width}
        onChangeText={setWidth}
        keyboardType="decimal-pad"
      />
      <MeasurementField
        label="Depth (metres)"
        value={depth}
        onChangeText={setDepth}
        keyboardType="decimal-pad"
      />
      <Action
        secondary
        label="Use these rectangular wall measurements"
        disabled={!ready || busy}
        onPress={() => {
          const w = num(width) * 100,
            d = num(depth) * 100;
          if (
            ![w, d].every((v) => Number.isFinite(v) && v >= 50 && v <= 3000)
          ) {
            setError("Enter dimensions between 0.5 and 30 metres.");
            return;
          }
          const rect = rectangle(w, d, g.ceilingHeight.value);
          edit({
            ...g,
            walls: rect.walls.map((w) => ({ ...w, source: "user-confirmed" })),
            orientationConfirmed: false,
          });
        }}
      />
      <Text style={s.section}>Review the structure</Text>
      <GeometryDrawing geometry={g} />
      <Text style={s.muted}>
        TOP is plan north, not compass north. Coordinates are centimetres from
        the top left. Bounding size: {Math.round(extents(g).width)} ×{" "}
        {Math.round(extents(g).depth)} cm. Any wall joins within 15 cm are
        inferred in the floor outline; correct mismatches below.
      </Text>
      <Action
        secondary
        label="Rotate scan 90° clockwise"
        onPress={() => setCapture(rotateCapture(capture))}
        disabled={!ready || busy}
      />
      <Action
        secondary
        label={
          g.orientationConfirmed
            ? "✓ Orientation confirmed"
            : "Confirm top / bottom orientation"
        }
        onPress={() =>
          setCapture({
            ...capture,
            geometry: { ...g, orientationConfirmed: true },
          })
        }
        disabled={!ready}
      />
      <MeasurementField
        label={`Ceiling height (cm), ${g.ceilingHeight.source}`}
        value={
          g.ceilingHeight.value === null ? "" : String(g.ceilingHeight.value)
        }
        keyboardType="decimal-pad"
        onChangeText={(v) =>
          edit({
            ...g,
            ceilingHeight: {
              value: v === "" ? null : num(v),
              source: "user-confirmed",
            },
          })
        }
      />
      <Action
        secondary
        label={
          showWalls
            ? "Hide wall coordinates"
            : "Correct wall coordinates and heights"
        }
        onPress={() => setShowWalls(!showWalls)}
      />
      {showWalls &&
        g.walls.map((wall, i) => (
          <View key={wall.id} style={{ gap: 8 }}>
            <Text style={s.label}>
              Wall {i + 1}, {wall.source}
              {wall.confidence
                ? `, category confidence ${wall.confidence}`
                : ""}
            </Text>
            {(["a", "b"] as const).map((end) => (
              <View key={end} style={{ gap: 8 }}>
                {(["x", "y"] as const).map((axis) => (
                  <MeasurementField
                    key={axis}
                    label={`Wall ${i + 1} ${end} ${axis} (cm)`}
                    value={String(wall[end][axis])}
                    keyboardType="decimal-pad"
                    onChangeText={(v) =>
                      edit({
                        ...g,
                        walls: g.walls.map((w) =>
                          w.id === wall.id
                            ? {
                                ...w,
                                [end]: { ...w[end], [axis]: num(v) },
                                source: "user-confirmed",
                              }
                            : w,
                        ),
                      })
                    }
                  />
                ))}
              </View>
            ))}
            <MeasurementField
              label={`Wall ${i + 1} height (cm), ${wall.height.source}`}
              value={
                wall.height.value === null ? "" : String(wall.height.value)
              }
              keyboardType="decimal-pad"
              onChangeText={(v) =>
                edit({
                  ...g,
                  walls: g.walls.map((w) =>
                    w.id === wall.id
                      ? {
                          ...w,
                          height: {
                            value: v === "" ? null : num(v),
                            source: "user-confirmed",
                          },
                        }
                      : w,
                  ),
                })
              }
            />
            <Action
              secondary
              label={`Split wall ${i + 1}`}
              onPress={() => {
                const mid = {
                  x: (wall.a.x + wall.b.x) / 2,
                  y: (wall.a.y + wall.b.y) / 2,
                };
                edit({
                  ...g,
                  walls: g.walls.flatMap((w) =>
                    w.id === wall.id
                      ? [
                          { ...w, b: mid, source: "user-confirmed" },
                          {
                            ...w,
                            id: newId(),
                            a: mid,
                            source: "user-confirmed",
                          },
                        ]
                      : [w],
                  ),
                });
              }}
            />
            {g.walls.length > 3 && (
              <Action
                secondary
                label={`Remove wall ${i + 1}`}
                onPress={() =>
                  edit({ ...g, walls: g.walls.filter((w) => w.id !== wall.id) })
                }
              />
            )}
          </View>
        ))}
      <Text style={s.section}>Doors, windows and missing details</Text>
      <Text style={s.muted}>
        Blank heights, projections and sill/base levels mean unknown. Add
        radiators, bulkheads and ceiling slopes manually. Door swings are
        unknown until checked. For a slope, record high/low heights and its
        extent in the note; it does not create an angled floor wall.
      </Text>
      {g.features.map((f, i) => (
        <View
          key={f.id}
          style={{
            gap: 8,
            borderTopWidth: 1,
            borderColor: "#CCC",
            paddingTop: 12,
          }}
        >
          <Text style={s.body}>
            {i + 1}. {f.kind}, {f.source}
          </Text>
          {(["a", "b"] as const).map((end) => (
            <View style={{ gap: 8 }} key={end}>
              {(["x", "y"] as const).map((axis) => (
                <MeasurementField
                  key={axis}
                  label={`${f.kind} ${i + 1} ${end} ${axis} (cm)`}
                  value={String(f[end][axis])}
                  keyboardType="decimal-pad"
                  onChangeText={(v) =>
                    feature(f.id, { [end]: { ...f[end], [axis]: num(v) } })
                  }
                />
              ))}
            </View>
          ))}
          {(["height", "base", "projection"] as const).map((k) => (
            <MeasurementField
              key={k}
              label={`${f.kind} ${i + 1} ${k} (cm), ${f[k].source}`}
              value={f[k].value === null ? "" : String(f[k].value)}
              keyboardType="decimal-pad"
              onChangeText={(v) =>
                feature(f.id, {
                  [k]: {
                    value: v === "" ? null : num(v),
                    source: "user-confirmed",
                  },
                })
              }
            />
          ))}
          {f.kind === "door" && (
            <View style={{ gap: 6 }}>
              <Text style={s.muted}>
                Swing, viewed facing the door from inside the room: {f.swing}
              </Text>
              {(
                [
                  "unknown",
                  "inward-left",
                  "inward-right",
                  "outward-left",
                  "outward-right",
                  "sliding",
                ] as const
              ).map((swing) => (
                <Action
                  secondary
                  key={swing}
                  label={`Door ${i + 1}: ${swing}`}
                  onPress={() => feature(f.id, { swing })}
                />
              ))}
            </View>
          )}
          <Field
            label={`${f.kind} ${i + 1} notes`}
            value={f.note}
            maxLength={1000}
            multiline
            onChangeText={(note) => feature(f.id, { note })}
          />
          <Action
            secondary
            label={`Remove ${f.kind} ${i + 1} from reviewed geometry`}
            onPress={() =>
              edit({ ...g, features: g.features.filter((v) => v.id !== f.id) })
            }
          />
        </View>
      ))}
      {(
        [
          "door",
          "window",
          "opening",
          "radiator",
          "bulkhead",
          "ceiling-slope",
          "other",
        ] as const
      ).map((kind) => (
        <Action
          secondary
          key={kind}
          label={`Add ${kind}`}
          disabled={g.features.length >= 150}
          onPress={() =>
            edit({
              ...g,
              features: [
                ...g.features,
                {
                  id: newId(),
                  kind,
                  a: { x: 0, y: 0 },
                  b: { x: 80, y: 0 },
                  source: "inferred",
                  height: { value: null, source: "inferred" },
                  base: { value: null, source: "inferred" },
                  projection: { value: null, source: "inferred" },
                  swing: "unknown",
                  note: "Position and dimensions need checking.",
                },
              ],
            })
          }
        />
      ))}
      <Field
        label="Unmeasured details and measurement notes"
        value={g.notes}
        multiline
        maxLength={3000}
        onChangeText={(notes) => edit({ ...g, notes })}
      />
      <Text style={s.section}>What existing furniture stays?</Text>
      <Text style={s.muted}>
        Scanned objects are a separate inventory. These choices describe the
        physical room; they do not delete your planned furniture or product
        references.
      </Text>
      <Action
        secondary
        label={`${capture.furnitureDecision === "all-going" ? "✓ " : ""}All existing furniture is going`}
        onPress={() =>
          setCapture({
            ...capture,
            furnitureDecision: "all-going",
            keptObjectIds: [],
          })
        }
      />
      <Action
        secondary
        label={`${capture.furnitureDecision === "choose" ? "✓ " : ""}Choose what stays`}
        onPress={() => setCapture({ ...capture, furnitureDecision: "choose" })}
      />
      {capture.furnitureDecision === "choose" && (
        <>
          {!capture.original?.objects.length && (
            <Text style={s.muted}>
              No furniture detected. Record what stays in the notes and add it
              to the planner with measured dimensions.
            </Text>
          )}
          {capture.original?.objects.map((o) => (
            <Action
              secondary
              key={o.id}
              label={`${capture.keptObjectIds.includes(o.id) ? "✓ Keep" : "Keep"} ${o.category} (${Math.round(o.dimensions[0] * 100)} × ${Math.round(o.dimensions[2] * 100)} cm)`}
              onPress={() =>
                setCapture({
                  ...capture,
                  keptObjectIds: capture.keptObjectIds.includes(o.id)
                    ? capture.keptObjectIds.filter((id) => id !== o.id)
                    : [...capture.keptObjectIds, o.id],
                })
              }
            />
          ))}
          <Text style={s.muted}>
            Kept objects are saved as constraints for the layout brief. Their
            detected sizes still need checking before specification.
          </Text>
        </>
      )}
      <Action
        secondary
        label={
          g.measurementsReviewed
            ? "✓ Measurements reviewed, unknowns recorded"
            : "Confirm measurements reviewed and unknowns recorded"
        }
        onPress={() =>
          setCapture({
            ...capture,
            geometry: { ...g, measurementsReviewed: true },
          })
        }
        disabled={!ready}
      />
      {geometryErrors(g).map((e) => (
        <Text key={e} style={s.error}>
          {e}
        </Text>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      <Text style={s.muted}>
        Applying saves this reviewed structure to {room.name}. Existing room
        contents stay at their current positions. Original scans and earlier
        reviewed structures remain in the backup. Cancel leaves the live room
        unchanged and keeps this review draft on this device.
      </Text>
      <Action
        label="Apply reviewed geometry to this room"
        disabled={
          !ready ||
          busy ||
          !g.orientationConfirmed ||
          !g.measurementsReviewed ||
          capture.furnitureDecision === "undecided" ||
          geometryErrors(g).length > 0
        }
        onPress={() =>
          void run(async () => {
            const checked = captureSchema.parse(capture);
            const next = applyCapture(
              { ...room, ideas: [...room.ideas, ...photos] },
              checked,
            );
            await queue.current;
            if (onSave(next)) {
              /* Retain recovery draft if device persistence subsequently fails. */
            } else
              throw new Error(
                "The project could not accept this change. Your draft is retained; check the storage message.",
              );
          })
        }
      />
    </View>
  );
}
