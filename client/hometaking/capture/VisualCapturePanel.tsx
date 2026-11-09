import React, { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Action, s } from "../ui";
import { Room } from "../model";
import { packVisual, VisualCapture } from "./visual";
const native =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<{
        visualSupport?: () => Promise<boolean>;
        captureVisual: () => Promise<string>;
        viewModel: (raw: string, visual: boolean) => Promise<boolean>;
      }>("HometakingRoomPlan")
    : null;
export function VisualCapturePanel({
  room,
  onAdd,
}: {
  room: Room;
  onAdd?: (capture: VisualCapture) => void;
}) {
  const [supported, setSupported] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pending, setPending] = useState<VisualCapture | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    let active = true;
    void native
      ?.visualSupport?.()
      .then((v) => {
        if (active) setSupported(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const captures = room.visualCaptures ?? [];
  useEffect(() => {
    if (pending && room.visualCaptures?.some((c) => c.id === pending.id))
      setPending(null);
  }, [room.visualCaptures, pending]);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.section}>Your room in 3D</Text>
      <Text style={s.body}>
        Capture camera colour and surface shape, including the ceiling. Keep
        this view alongside the measured plan. It does not change your room
        dimensions or remove existing furniture.
      </Text>
      {room.structure?.current.original && (
        <Action
          secondary
          disabled={busy || !native?.viewModel}
          label="View original scan in 3D"
          onPress={() =>
            void run(async () => {
              await native!.viewModel(
                room.structure!.current.original!.raw,
                false,
              );
            })
          }
        />
      )}
      {captures.map((c, i) => (
        <Action
          key={c.id}
          secondary
          disabled={busy || !native?.viewModel}
          label={`Open camera-textured capture ${i + 1}`}
          onPress={() =>
            void run(async () => {
              await native!.viewModel(c.chunks.join(""), true);
            })
          }
        />
      ))}
      {onAdd && (
        <Action
          disabled={busy || !supported || captures.length >= 3}
          label={busy ? "Working…" : "Capture camera-textured 3D"}
          onPress={() =>
            void run(async () => {
              setPending(packVisual(await native!.captureVisual()));
              setAcknowledged(false);
            })
          }
        />
      )}
      {!supported && (
        <Text style={s.muted}>
          Camera-textured capture needs the updated native Hometaking app on a
          supported LiDAR device. Saved visual captures remain included in
          backups on every platform.
        </Text>
      )}
      {captures.length >= 3 && (
        <Text style={s.muted}>
          Three visual captures are retained. Export a backup before making
          further captures; none will be replaced automatically.
        </Text>
      )}
      {pending && (
        <View style={{ gap: 12 }}>
          <Text style={s.body}>
            New capture: {pending.photoCount} camera views.{" "}
            {Math.round(
              (100 * pending.texturedTriangleCount) / pending.triangleCount,
            )}
            % of observed triangles have matched photographs. This is not a
            measure of room completeness or accuracy.
          </Text>
          <Action
            secondary
            disabled={busy}
            label="Inspect new 3D capture"
            onPress={() =>
              void run(async () => {
                await native!.viewModel(pending.chunks.join(""), true);
                setAcknowledged(true);
              })
            }
          />
          <Text style={s.muted}>
            Check both ceiling slopes and the window intersection in Colour,
            Shape and Photos. Grey surfaces and holes need more capture. This
            separate camera view is not yet aligned with the editable floor
            plan.
          </Text>
          <Action
            disabled={busy || !acknowledged}
            label="Keep this capture with the room"
            onPress={() => {
              onAdd?.(pending);
            }}
          />
          <Action
            secondary
            disabled={busy}
            label="Discard this preview"
            onPress={() => setPending(null)}
          />
        </View>
      )}
      {!!error && <Text style={s.error}>{error}</Text>}
      <Text style={s.muted}>
        Camera textures help inspect appearance; they cannot certify
        measurements or recover unseen surfaces. Glass may remain incomplete.
        New captures preserve earlier versions.
      </Text>
    </View>
  );
}
