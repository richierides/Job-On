import { resizeCorner } from "./integration/editing";
import { keptObjects } from "./capture/geometry";
import { GeometryDrawing } from "./capture/GeometryDrawing";
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Furniture,
  Room,
  cm,
  issues,
  snapPlacement,
  doorGeometry,
} from "./model";
import Svg, { Path, Line, Rect, Text as SvgText } from "react-native-svg";
import { palette as c } from "./tokens";

// Local top is the back/headboard, matching negative Z in the 3D scene.
function FurnitureSymbol({ item }: { item: Furniture }) {
  const kind = (item.archetype ?? item.name).toLowerCase();
  const ink = ["#65674A", "#A64B32", "#333333"].includes(item.colour)
    ? "#FFFFFF"
    : c.ink;
  if (item.kind === "door" || item.kind === "window" || item.kind === "rug")
    return null;
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      {kind.includes("bed") ? (
        <>
          <Rect x="3" y="2" width="94" height="7" fill={ink} opacity={0.8} />
          <Rect
            x="10"
            y="13"
            width="35"
            height="17"
            rx="4"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
          <Rect
            x="55"
            y="13"
            width="35"
            height="17"
            rx="4"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
          <Path
            d="M 6 37 H 94 M 6 37 V 94 H 94 V 37"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
        </>
      ) : kind.includes("chair") || kind.includes("sofa") ? (
        <>
          <Rect
            x="8"
            y="3"
            width="84"
            height="12"
            rx="4"
            fill={ink}
            opacity={0.8}
          />
          <Path
            d="M 9 22 V 82 H 91 V 22 M 19 22 V 72 H 81 V 22"
            fill="none"
            stroke={ink}
            strokeWidth="3"
          />
          <Path
            d="M 43 88 L 50 95 L 57 88"
            fill="none"
            stroke={ink}
            strokeWidth="3"
          />
        </>
      ) : kind.includes("wardrobe") || kind.includes("cupboard") ? (
        <>
          <Path
            d="M 4 90 H 96 M 50 10 V 90 M 43 70 V 80 M 57 70 V 80"
            fill="none"
            stroke={ink}
            strokeWidth="3"
          />
        </>
      ) : kind.includes("desk") ? (
        <>
          <Path
            d="M 5 8 H 95 M 5 88 H 28 V 25 H 5 M 10 45 H 23 M 10 65 H 23"
            fill="none"
            stroke={ink}
            strokeWidth="2"
          />
        </>
      ) : (
        <Rect
          x="6"
          y="8"
          width="88"
          height="84"
          rx="5"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
      )}
    </Svg>
  );
}

function Piece({
  item: originalItem,
  room,
  scale,
  selected,
  problem,
  onSelect,
  onMove,
}: {
  item: Furniture;
  room: Room;
  scale: number;
  selected: boolean;
  problem: boolean;
  onSelect: () => void;
  onMove: (it: Furniture) => void;
}) {
  const [resizePreview, setResizePreview] = useState<Furniture | null>(null);
  const item = resizePreview ?? originalItem;
  const resizeStart = useRef(originalItem);
  const resize = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          resizeStart.current = latest.current.item;
          latest.current.onSelect();
        },
        onPanResponderMove: (_, g) => {
          const p = latest.current;
          const next = resizeCorner(
            resizeStart.current,
            g.dx / p.scale,
            g.dy / p.scale,
          );
          setResizePreview(next);
        },
        onPanResponderRelease: (_, g) => {
          const p = latest.current;
          p.onMove(
            resizeCorner(resizeStart.current, g.dx / p.scale, g.dy / p.scale),
          );
          setResizePreview(null);
        },
        onPanResponderTerminate: () => setResizePreview(null),
      }),
    [],
  );
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const latest = useRef({ item, room, scale, onMove, onSelect });
  latest.current = { item: originalItem, room, scale, onMove, onSelect };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderGrant: () => latest.current.onSelect(),
        onPanResponderMove: (_, g) => {
          const p = latest.current;
          const snapped = snapPlacement(
            p.item,
            p.item.x + g.dx / p.scale,
            p.item.y + g.dy / p.scale,
            p.room,
          );
          setDelta({
            x: (snapped.x - p.item.x) * p.scale,
            y: (snapped.y - p.item.y) * p.scale,
          });
        },
        onPanResponderRelease: (_, g) => {
          const p = latest.current;
          p.onMove(
            snapPlacement(
              p.item,
              p.item.x + g.dx / p.scale,
              p.item.y + g.dy / p.scale,
              p.room,
            ),
          );
          setDelta({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => setDelta({ x: 0, y: 0 }),
      }),
    [],
  );
  return (
    <View
      {...responder.panHandlers}
      style={{
        position: "absolute",
        left: (item.x - item.width / 2) * scale + delta.x,
        top: (item.y - item.depth / 2) * scale + delta.y,
        width: item.width * scale,
        height: item.depth * scale,
        transform: [{ rotate: `${item.rotation}deg` }],
        zIndex: selected ? 4 : item.kind === "rug" ? 0 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${item.name}`}
        hitSlop={item.kind === "door" ? 20 : undefined}
        onPress={onSelect}
        style={[
          styles.piece,
          {
            backgroundColor: item.kind === "door" ? "#EAE5DB" : item.colour,
            borderColor: problem ? c.accent : selected ? c.ink : "#00000030",
            borderWidth: item.kind === "door" ? 0 : selected || problem ? 3 : 1,
            padding: item.kind === "door" ? 0 : 2,
          },
        ]}
      >
        <FurnitureSymbol item={item} />
        {item.kind !== "window" && item.kind !== "door" && (
          <Text
            numberOfLines={2}
            style={{
              color: ["#65674A", "#A64B32", "#333333"].includes(item.colour)
                ? "white"
                : c.ink,
              fontSize: Math.max(10, Math.min(13, (item.width * scale) / 9)),
              fontWeight: "600",
              backgroundColor: item.colour,
              paddingHorizontal: 2,
              textAlign: "center",
              transform: [{ rotate: `${-item.rotation}deg` }],
            }}
          >
            {item.name}
          </Text>
        )}
      </Pressable>
      {selected && ["furniture", "rug", "shelf"].includes(item.kind) && (
        <View
          {...resize.panHandlers}
          accessibilityLabel="Resize selected item"
          style={{
            position: "absolute",
            right: -10,
            bottom: -10,
            width: 24,
            height: 24,
            backgroundColor: c.paper,
            borderColor: c.ink,
            borderWidth: 2,
          }}
        />
      )}
    </View>
  );
}
export function RoomPlan({
  room,
  selectedId,
  onSelect,
  onMove,
}: {
  room: Room;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (it: Furniture) => void;
}) {
  const [width, setWidth] = useState(320);
  const available = width - 34,
    scale = Math.min(available / room.width, 340 / room.depth);
  const warnings = issues(room),
    affected = new Set(warnings.flatMap((w) => w.ids));
  const existing = room.structure ? keptObjects(room.structure.current) : [];
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      <View style={{ width: room.width * scale, alignSelf: "center" }}>
        <Text style={styles.measure}>{cm(room.width)}</Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          testID="room-floor"
          style={{
            width: room.width * scale,
            height: room.depth * scale,
            backgroundColor: room.structure ? c.paper : "#EAE5DB",
          }}
        >
          {/* Draw walls outside the measured floor so borders do not offset coordinates. */}
          {!room.structure && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -2,
                top: -2,
                right: -2,
                bottom: -2,
                borderWidth: 2,
                borderColor: c.ink,
              }}
            />
          )}
          {room.structure && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <GeometryDrawing
                geometry={room.structure.current.geometry}
                overlay
              />
            </View>
          )}
          {room.items
            .filter(
              (it) =>
                !room.structure ||
                !["door", "window", "fixed"].includes(it.kind),
            )
            .map((it) => (
              <Piece
                key={it.id}
                item={it}
                room={room}
                scale={scale}
                selected={selectedId === it.id}
                problem={affected.has(it.id)}
                onSelect={() => onSelect(it.id)}
                onMove={onMove}
              />
            ))}
          <Svg
            pointerEvents="none"
            width={room.width * scale}
            height={room.depth * scale}
            viewBox={`0 0 ${room.width} ${room.depth}`}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              overflow: "visible",
            }}
          >
            {existing.map((it) => (
              <React.Fragment key={it.id}>
                <Rect
                  x={it.x - it.width / 2}
                  y={it.y - it.depth / 2}
                  width={it.width}
                  height={it.depth}
                  rotation={it.rotation}
                  originX={it.x}
                  originY={it.y}
                  fill="#B4AD98"
                  fillOpacity={0.4}
                  stroke="#786D54"
                  strokeDasharray="6 3"
                />
                <SvgText x={it.x} y={it.y} fontSize={12} textAnchor="middle">
                  {it.name}
                </SvgText>
              </React.Fragment>
            ))}
            {room.items
              .filter((i) => !room.structure && i.kind === "door")
              .map((it) => {
                const g = doorGeometry(it, room);
                return (
                  <React.Fragment key={it.id}>
                    <Line
                      x1={g.hinge.x}
                      y1={g.hinge.y}
                      x2={g.closed.x}
                      y2={g.closed.y}
                      stroke="#EAE5DB"
                      strokeWidth={6 / scale}
                    />
                    {!!it.hinge && (
                      <Path
                        d={`M ${g.closed.x} ${g.closed.y} A ${it.width} ${it.width} 0 0 ${it.hinge === "right" ? 0 : 1} ${g.open.x} ${g.open.y}`}
                        fill="none"
                        stroke={c.muted}
                        strokeWidth={1 / scale}
                        strokeDasharray={`${4 / scale},${3 / scale}`}
                      />
                    )}
                    {!!it.hinge && (
                      <Line
                        x1={g.hinge.x}
                        y1={g.hinge.y}
                        x2={g.open.x}
                        y2={g.open.y}
                        stroke={c.ink}
                        strokeWidth={2 / scale}
                      />
                    )}
                    <SvgText
                      x={(g.hinge.x + g.closed.x + g.open.x) / 3}
                      y={(g.hinge.y + g.closed.y + g.open.y) / 3}
                      fontSize={11 / scale}
                      fill={c.ink}
                      textAnchor="middle"
                    >
                      {it.hinge ? "Door" : "Door, swing unknown"}
                    </SvgText>
                  </React.Fragment>
                );
              })}
          </Svg>
        </View>
        <Text
          style={{
            position: "absolute",
            right: -13,
            fontSize: 11,
            color: c.muted,
            transform: [{ rotate: "90deg" }],
          }}
        >
          {cm(room.depth)}
        </Text>
      </View>
      {room.structure && (
        <Text style={styles.caption}>
          Reviewed walls and fixed features. Dashed furniture is existing
          furniture marked to stay. Edit structure through Room measurements;
          older fixed-feature records remain in the backup.
        </Text>
      )}
      <Text style={styles.caption}>
        Drag to snap to a 10 cm grid or a nearby wall. Tap to edit.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { paddingVertical: 18 },
  piece: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
    padding: 2,
  },
  measure: {
    fontSize: 12,
    color: c.muted,
    textAlign: "center",
    marginBottom: 10,
  },
  caption: { fontSize: 12, color: c.muted, textAlign: "center", marginTop: 18 },
});
