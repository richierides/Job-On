import { ConversationPanel } from "./integration/ConversationPanel";
import { HouseholdWork } from "./integration/HouseholdWork";
import { AccountPanel } from "./integration/AccountPanel";
import { ImportPanel } from "./integration/ImportPanel";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import RoomReveal from "./RoomReveal";
import { VisualCapturePanel } from "./capture/VisualCapturePanel";
import { ProjectProvider, useProject } from "./store";
import {
  Furniture,
  isSpecified,
  Idea,
  Project,
  cm,
  issues,
  money,
  newId,
  nearestWall,
  place,
} from "./model";
import { RoomPlan } from "./RoomPlan";
import {
  Check,
  FurnitureForm,
  IdeaForm,
  pictureSource,
  RoomForm,
  RoomBriefForm,
  DoorForm,
} from "./forms";
import { exportProject, importProject, pickPictures } from "./media";
import {
  Action,
  Eyebrow,
  Field,
  Heading,
  Icon,
  IconButton,
  Sheet,
  s,
} from "./ui";
import { palette as c, displayFont } from "./tokens";

type Tab = "Home" | "Ideas" | "Rooms" | "Reveal" | "Works";
export default function HometakingScreen() {
  return (
    <ProjectProvider>
      <Studio />
    </ProjectProvider>
  );
}
function Studio() {
  const store = useProject(),
    { project, update, updateRoom } = store;

  const room =
    project.rooms.find((r) => r.id === project.activeRoomId) ??
    project.rooms[0];
  const [tab, setTab] = useState<Tab>("Home"),
    [sheet, setSheet] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [idea, setIdea] = useState<Idea | null>(null),
    [draft, setDraft] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [buy, setBuy] = useState(false),
    [pending, setPending] = useState<Project | null>(null);
  useEffect(() => {
    const show = (url: string | null) => {
      if (
        url &&
        (url.startsWith("homediytracker://auth") ||
          /[?#](code|access_token|type=recovery)/.test(url))
      )
        setSheet("settings");
    };
    void Linking.getInitialURL().then(show);
    const sub = Linking.addEventListener("url", (e) => show(e.url));
    return () => sub.remove();
  }, []);
  const go = (next: Tab) => {
    setTab(next);
    if (room && next !== "Home" && room.journey !== next)
      update(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) =>
            r.id === room.id ? { ...r, journey: next } : r,
          ),
        }),
        false,
      );
  };
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deletingRoom = project.rooms.find((r) => r.id === deleteId);
  const piece = room?.items.find((i) => i.id === selected);
  const close = () => setSheet(null);
  const mutate = (item: Furniture) =>
    room &&
    updateRoom(room.id, (r) => ({
      ...r,
      items: r.items.map((i) => (i.id === item.id ? item : i)),
    }));
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(
        (e as Error).message || "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const addPicture = () =>
    run(async () => {
      if (!room) return;
      const images = await pickPictures(30 - room.ideas.length);
      if (!images.length) return;
      if (images.length === 1) {
        setIdea({
          id: newId(),
          image: images[0],
          note: "",
          role: "Inspiration",
        });
        setSheet("idea");
        return;
      }
      const additions: Idea[] = images.map((image) => ({
        id: newId(),
        image,
        note: "",
        role: "Inspiration",
      }));
      const next = {
        ...project,
        rooms: project.rooms.map((r) =>
          r.id === room.id ? { ...r, ideas: [...r.ideas, ...additions] } : r,
        ),
      };
      if (JSON.stringify(next).length > 4_000_000)
        throw new Error(
          "These pictures would exceed the project storage limit. Choose fewer or smaller pictures. Nothing was added.",
        );
      updateRoom(room.id, (r) => ({ ...r, ideas: [...r.ideas, ...additions] }));
      setNotice(
        `${images.length} pictures added. Tap each picture to add a note about what you like.`,
      );
    });
  const work = () => {
    setDraft("");
    setSheet("work");
  };
  const hero =
    room?.ideas.find((i) => i.role === "Inspiration")?.image ??
    room?.ideas[0]?.image ??
    "sample:room";
  const warnings = room ? issues(room) : [];
  const purchases =
    room?.items.filter(
      (i) =>
        ["furniture", "rug", "shelf"].includes(i.kind) &&
        !i.owned &&
        isSpecified(i),
    ) ?? [];
  return (
    <SafeAreaView style={a.safe} edges={["top", "bottom"]}>
      <View style={a.shell}>
        <View style={a.top}>
          <View>
            <Text style={a.brand}>Hometaking.</Text>
            <Text style={s.muted}>
              {store.syncing
                ? "Syncing"
                : store.cloudSaved
                  ? "Saved to household"
                  : store.saved
                    ? "Saved on this device"
                    : "Saving…"}
            </Text>
          </View>
          <IconButton
            name="sliders"
            label="Project settings"
            onPress={() => setSheet("settings")}
          />
        </View>
        {store.loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={c.accent} />
        ) : (
          <ScrollView key={tab} contentContainerStyle={a.content}>
            {!!(store.error || notice) && (
              <View style={{ gap: 8, marginBottom: 16 }}>
                <Text accessibilityRole="alert" style={s.error}>
                  {store.error || notice}
                </Text>
                {!!store.error && (
                  <Action
                    secondary
                    label="Retry saving or loading"
                    onPress={store.retry}
                  />
                )}
              </View>
            )}
            {tab !== "Home" && room && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose room"
                onPress={() => setSheet("choose")}
                style={[s.between, { marginBottom: 20 }]}
              >
                <Eyebrow>
                  {room.name.toUpperCase()}
                  {room.sample ? " / EXAMPLE" : ""}
                </Eyebrow>
                <Text style={s.muted}>
                  Switch room ({project.rooms.length}) ▾
                </Text>
              </Pressable>
            )}
            {room && tab !== "Home" && (
              <View style={{ marginBottom: 24, gap: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    borderBottomWidth: 1,
                    borderColor: c.line,
                  }}
                >
                  {["Brief", "Room", "Ideas", "Layout", "Reveal", "Work"].map(
                    (label, index) => (
                      <Pressable
                        key={label}
                        accessibilityRole="button"
                        accessibilityLabel={`Step ${index + 1}: ${label.toLowerCase()}`}
                        onPress={() => {
                          if (index === 0) setSheet("brief");
                          else if (index === 1) setSheet("measure");
                          else
                            go(
                              (["Ideas", "Rooms", "Reveal", "Works"] as const)[
                                index - 2
                              ],
                            );
                        }}
                        style={{
                          flex: 1,
                          minHeight: 48,
                          borderBottomWidth: 2,
                          borderBottomColor:
                            index ===
                            (
                              {
                                Ideas: 2,
                                Rooms: 3,
                                Reveal: 4,
                                Works: 5,
                              } as Record<string, number>
                            )[tab]
                              ? c.accent
                              : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{ fontSize: 10, color: c.muted }}
                        >{`0${index + 1}`}</Text>
                        <Text
                          style={{ fontSize: 12, color: c.ink, marginTop: 3 }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit design brief"
                  onPress={() => setSheet("brief")}
                  style={{ gap: 4 }}
                >
                  <Text style={s.eyebrow}>
                    THE BRIEF
                    {room.forWhom ? ` / ${room.forWhom.toUpperCase()}` : ""}
                  </Text>
                  <Text style={s.body} numberOfLines={2}>
                    {room.purpose ||
                      room.brief ||
                      "Start with what this room needs to do for you."}
                  </Text>
                  {!!room.purpose && !!room.brief && (
                    <Text style={s.muted} numberOfLines={2}>
                      {room.brief}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
            {tab === "Home" && (
              <>
                <Eyebrow>ROOM FOR POSSIBILITY</Eyebrow>
                <Heading>A home,{"\n"}in the making.</Heading>
                <View style={{ gap: 10, marginBottom: 24 }}>
                  <Text style={s.section}>
                    Your rooms ({project.rooms.length})
                  </Text>
                  {project.rooms.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open room: ${r.name}`}
                      onPress={() => {
                        update((p) => ({ ...p, activeRoomId: r.id }), false);
                        setSelected(null);
                        setTab(r.journey ?? "Ideas");
                      }}
                      style={[
                        s.between,
                        {
                          padding: 14,
                          borderWidth: 1,
                          borderColor: r.id === room?.id ? c.ink : c.line,
                          gap: 12,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.body}>
                          {r.name}
                          {r.sample ? " (example)" : ""}
                          {r.imported ? " (Room Planner import)" : ""}
                        </Text>
                        <Text style={s.muted}>
                          {cm(r.width)} × {cm(r.depth)} · {r.items.length} items
                        </Text>
                      </View>
                      <Icon name="arrow-up-right" />
                    </Pressable>
                  ))}
                  {!project.rooms.length && (
                    <Text style={s.muted}>
                      Add your first room to get started.
                    </Text>
                  )}
                </View>

                {room && !room.sample && !room.ideas.length ? (
                  <View
                    style={{
                      paddingVertical: 20,
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: c.line,
                      gap: 12,
                    }}
                  >
                    <Eyebrow>YOUR ROOM BRIEF</Eyebrow>
                    <Text style={s.body}>
                      {room.purpose ||
                        room.brief ||
                        "What should this room make possible?"}
                    </Text>
                    {!!room.purpose && !!room.brief && (
                      <Text style={s.muted}>{room.brief}</Text>
                    )}
                    <Action
                      secondary
                      label="Edit design brief"
                      onPress={() => setSheet("brief")}
                    />
                  </View>
                ) : (
                  <Image
                    source={pictureSource(hero)}
                    style={a.hero}
                    contentFit="cover"
                  />
                )}
                <View style={{ paddingTop: 16, paddingBottom: 22 }}>
                  <Eyebrow>
                    {room?.sample
                      ? "THE EXAMPLE ROOM"
                      : room?.ideas.length
                        ? "YOUR INSPIRATION"
                        : "YOUR ROOM"}
                  </Eyebrow>
                  <View style={s.between}>
                    <View>
                      <Text style={s.section}>
                        {room?.name ?? "Start somewhere."}
                      </Text>
                      <Text style={s.muted}>
                        {room
                          ? `${cm(room.width)} × ${cm(room.depth)} · ${((room.width * room.depth) / 10000).toFixed(1)} m²`
                          : "Make a little room for your ideas."}
                      </Text>
                    </View>
                    {room && (
                      <IconButton
                        name="arrow-up-right"
                        label="Continue designing"
                        onPress={() => go(room?.journey ?? "Ideas")}
                      />
                    )}
                  </View>
                </View>
                <Action
                  icon="plus"
                  label="Add a room"
                  onPress={() => setSheet("newroom")}
                />
                {project.rooms.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Action
                      secondary
                      icon="list"
                      label="Manage rooms"
                      onPress={() => setSheet("choose")}
                    />
                  </View>
                )}
                {room && (
                  <>
                    <View style={s.rule} />
                    <View style={s.between}>
                      <Text style={s.section}>
                        {room.journey === "Works"
                          ? "Make it happen."
                          : room.journey === "Reveal"
                            ? "See your room."
                            : room.journey === "Rooms"
                              ? "Arrange the room."
                              : "Find the feeling."}
                      </Text>
                      <IconButton
                        name="arrow-right"
                        label="Continue your room"
                        onPress={() => go(room.journey ?? "Ideas")}
                      />
                    </View>
                    <Text style={s.body}>
                      {room.purpose ||
                        "Bring your brief, pictures, layout and work together."}
                    </Text>
                  </>
                )}
              </>
            )}
            {!room && tab !== "Home" && (
              <>
                <Heading>Your home,{"\n"}starts here.</Heading>
                <Text style={[s.body, { marginBottom: 24 }]}>
                  Add a room to collect pictures, plan furniture and keep track
                  of the work.
                </Text>
                <Action
                  label="Add a room"
                  onPress={() => setSheet("newroom")}
                />
              </>
            )}
            {room && tab === "Ideas" && (
              <>
                <Heading>The direction.</Heading>
                <Text style={[s.body, { marginBottom: 24 }]}>
                  Gather pictures that express your brief. Then use them as a
                  reference while you arrange the room.
                </Text>
                <View style={a.grid}>
                  {room.ideas.map((i, index) => (
                    <Pressable
                      key={i.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit idea ${index + 1}`}
                      style={{ width: "48%", marginTop: index % 2 ? 28 : 0 }}
                      onPress={() => {
                        setIdea(i);
                        setSheet("idea");
                      }}
                    >
                      <Image
                        source={pictureSource(i.image)}
                        style={{ height: index % 2 ? 170 : 220, width: "100%" }}
                        contentFit="cover"
                      />
                      <Text
                        style={[s.eyebrow, { marginTop: 10, marginBottom: 6 }]}
                      >
                        {i.role.toUpperCase()}
                      </Text>
                      <Text style={s.muted} numberOfLines={3}>
                        {i.note || "Add what you love about it."}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ marginTop: 24 }}>
                  <Action
                    icon="plus"
                    label={busy ? "Opening pictures…" : "Add pictures"}
                    disabled={busy}
                    onPress={() => {
                      void addPicture();
                    }}
                  />
                </View>
                <Text style={[s.muted, { marginTop: 12 }]}>
                  Add pictures now or come back to them later. Your brief stays
                  with the layout.
                </Text>
                <View style={{ marginTop: 20 }}>
                  <Action
                    label="Next: arrange the room"
                    icon="arrow-right"
                    onPress={() => go("Rooms")}
                  />
                </View>
              </>
            )}
            {room && tab === "Rooms" && (
              <>
                <View style={s.between}>
                  <View style={{ flex: 1 }}>
                    <Heading>{room.name}.</Heading>
                    {room.imported && (
                      <Text style={s.muted}>
                        Imported source plan. Original dimensions and item types
                        are preserved. Check heights, door swing and
                        classifications before relying on it.
                      </Text>
                    )}
                  </View>
                  <IconButton
                    name="more-horizontal"
                    label="Room options"
                    onPress={() => setSheet("roomoptions")}
                  />
                </View>
                <Eyebrow>
                  {room.structure ? "REVIEWED PLAN" : "ROOM PLAN"} /{" "}
                  {cm(room.height)} HIGH
                </Eyebrow>
                <Action
                  secondary
                  icon="log-in"
                  label={
                    room.structure
                      ? "Review walls, doors and fixed features"
                      : room.items.some((i) => i.kind === "door")
                        ? "Add another door"
                        : "Add the door"
                  }
                  onPress={() => {
                    setSelected(null);
                    setSheet(room.structure ? "measure" : "door");
                  }}
                />
                <Action
                  secondary
                  label="Discuss the layout"
                  onPress={() => setSheet("conversation")}
                />
                <VisualCapturePanel
                  key={`visual-${room.id}`}
                  room={room}
                  onAdd={(capture) =>
                    updateRoom(room.id, (r) => ({
                      ...r,
                      visualCaptures: [...(r.visualCaptures ?? []), capture],
                    }))
                  }
                />
                <RoomPlan
                  room={room}
                  selectedId={selected}
                  onSelect={setSelected}
                  onMove={mutate}
                />
                {piece && (
                  <View style={a.selection}>
                    <View style={s.between}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.section}>{piece.name}</Text>
                        <Text style={s.muted}>
                          {piece.width} × {piece.depth} ×{" "}
                          {piece.height ?? "height unknown"} cm ·{" "}
                          {piece.rotation}°
                        </Text>
                      </View>
                      <IconButton
                        name="edit-2"
                        label="Edit selected piece"
                        onPress={() => setSheet("furniture")}
                      />
                    </View>
                    <View style={[s.between, { marginTop: 10 }]}>
                      {(
                        [
                          [-10, 0, "arrow-left", "Move left"],
                          [0, -10, "arrow-up", "Move up"],
                          [0, 10, "arrow-down", "Move down"],
                          [10, 0, "arrow-right", "Move right"],
                        ] as const
                      ).map(([dx, dy, icon, label]) => (
                        <IconButton
                          key={label}
                          name={icon}
                          label={label}
                          onPress={() =>
                            mutate(
                              place(piece, piece.x + dx, piece.y + dy, room),
                            )
                          }
                        />
                      ))}
                      {piece.kind !== "door" && (
                        <IconButton
                          name="rotate-cw"
                          label="Rotate piece"
                          onPress={() => {
                            const p = {
                              ...piece,
                              rotation: (piece.rotation + 90) % 360,
                            };
                            mutate(place(p, p.x, p.y, room));
                          }}
                        />
                      )}
                    </View>
                    {!room.structure &&
                      /(bed|chair|sofa|wardrobe|cupboard)/i.test(
                        piece.archetype ?? piece.name,
                      ) && (
                        <Action
                          secondary
                          label="Put back against nearest wall"
                          onPress={() => {
                            const wall = nearestWall(piece, room);
                            const rotation = {
                              north: 0,
                              east: 90,
                              south: 180,
                              west: 270,
                            }[wall];
                            const p = { ...piece, rotation };
                            mutate(
                              place(
                                p,
                                wall === "west"
                                  ? 0
                                  : wall === "east"
                                    ? room.width
                                    : p.x,
                                wall === "north"
                                  ? 0
                                  : wall === "south"
                                    ? room.depth
                                    : p.y,
                                room,
                              ),
                            );
                          }}
                        />
                      )}
                    <Action
                      secondary
                      icon="trash-2"
                      label={`Remove ${piece.name}`}
                      onPress={() => {
                        updateRoom(room.id, (r) => ({
                          ...r,
                          items: r.items.filter((i) => i.id !== piece.id),
                        }));
                        setSelected(null);
                      }}
                    />
                    <Text style={s.muted}>
                      {piece.kind === "door"
                        ? "Doors stay on their chosen wall. Edit to change the wall."
                        : "Arrow controls move 10 cm at a time. The headboard or solid back edge shows orientation; chair arrows point forwards. Rotate to match your layout. Removal can be undone."}
                    </Text>
                  </View>
                )}
                {warnings.length > 0 && (
                  <View style={{ gap: 5, marginVertical: 16 }}>
                    {warnings.map((w, i) => (
                      <Text key={i} style={s.error}>
                        {w.message}
                      </Text>
                    ))}
                  </View>
                )}
                <View style={{ gap: 10, marginTop: 16 }}>
                  <Action
                    icon="plus"
                    label="Add furniture or feature"
                    onPress={() => {
                      setSelected(null);
                      setSheet("furniture");
                    }}
                  />
                  <Action
                    secondary
                    icon="corner-up-left"
                    label="Undo last change"
                    disabled={!store.canUndo}
                    onPress={store.undo}
                  />
                </View>
                <View style={s.rule} />
                <Text style={s.section}>In the room</Text>
                {room.structure && (
                  <Text style={s.muted}>
                    Fixed features now come from the reviewed structure. Earlier
                    fixed-feature records are retained in your backup.
                  </Text>
                )}
                {room.items
                  .filter(
                    (i) =>
                      !room.structure ||
                      !["door", "window", "fixed"].includes(i.kind),
                  )
                  .map((i) => (
                    <Pressable
                      key={i.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${i.name}`}
                      onPress={() => {
                        setSelected(i.id);
                        setSheet("furniture");
                      }}
                      style={a.listRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.body}>{i.name}</Text>
                        <Text style={s.muted}>
                          {i.width} × {i.depth} cm ·{" "}
                          {i.owned
                            ? "Already yours"
                            : isSpecified(i)
                              ? "Product chosen"
                              : "Basic layout item"}
                        </Text>
                      </View>
                      <Icon name="arrow-up-right" size={18} />
                    </Pressable>
                  ))}
                <Text style={[s.muted, { marginTop: 16 }]}>
                  This plan checks floor space. Verify measurements, door swings
                  and clearances in the room before buying.
                </Text>
              </>
            )}
            {room && tab === "Rooms" && (
              <View style={{ marginVertical: 20, gap: 10 }}>
                <Text style={s.muted}>
                  Does the layout make room for everything in your brief? Next,
                  reveal the room in 3D and specify the pieces you want, before
                  moving on to the work.
                </Text>
                <Action
                  label="Next: reveal the room"
                  icon="arrow-right"
                  onPress={() => go("Reveal")}
                />
              </View>
            )}
            {room && tab === "Reveal" && (
              <RoomReveal
                key={room.id}
                room={room}
                onSpecify={(i) => {
                  setSelected(i.id);
                  setSheet("furniture");
                }}
                onWallColour={(colour) =>
                  updateRoom(room.id, (r) => ({ ...r, wallColour: colour }))
                }
                onContinue={() => go("Works")}
              />
            )}
            {room && tab === "Works" && (
              <>
                <Heading>Make it happen.</Heading>
                {room.ideas.length > 0 && (
                  <>
                    {" "}
                    <Image
                      source={pictureSource(hero)}
                      style={{ width: "100%", height: 150 }}
                      contentFit="cover"
                    />
                    <Text style={[s.eyebrow, { marginTop: 8 }]}>
                      DESIGN INSPIRATION
                    </Text>
                  </>
                )}
                <View style={[s.row, { marginBottom: 8 }]}>
                  {["To do", "To buy"].map((v, i) => (
                    <Pressable
                      key={v}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: buy === (i === 1) }}
                      aria-selected={buy === (i === 1)}
                      onPress={() => setBuy(i === 1)}
                      style={[
                        s.tab,
                        buy === (i === 1) && { borderBottomColor: c.accent },
                      ]}
                    >
                      <Text
                        style={[
                          s.tabText,
                          buy === (i === 1) && { color: c.ink },
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {!buy ? (
                  <>
                    <Text style={s.muted}>
                      {room.works.filter((w) => w.done).length} of{" "}
                      {room.works.length} complete
                    </Text>
                    {room.works.map((w) => (
                      <View key={w.id} style={a.listRow}>
                        <View style={{ flex: 1 }}>
                          <Check
                            label={w.title}
                            checked={w.done}
                            onPress={() =>
                              updateRoom(room.id, (r) => ({
                                ...r,
                                works: r.works.map((t) =>
                                  t.id === w.id ? { ...t, done: !t.done } : t,
                                ),
                              }))
                            }
                          />
                        </View>
                        <IconButton
                          name="x"
                          label={`Remove task ${w.title}`}
                          onPress={() =>
                            updateRoom(room.id, (r) => ({
                              ...r,
                              works: r.works.filter((t) => t.id !== w.id),
                            }))
                          }
                        />
                      </View>
                    ))}
                    <View style={{ marginTop: 10 }}>
                      <Action icon="plus" label="Add a task" onPress={work} />
                    </View>
                  </>
                ) : (
                  <>
                    {!purchases.length && (
                      <Text style={s.body}>
                        No products to buy yet. Start with basic items in Rooms,
                        then specify products when you are happy with the
                        layout.
                      </Text>
                    )}
                    {purchases.map((i) => (
                      <View key={i.id} style={a.listRow}>
                        {i.image && (
                          <Image
                            source={pictureSource(i.image)}
                            style={{ width: 64, height: 64 }}
                            contentFit="contain"
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={s.body}>{i.name}</Text>
                          <Text style={s.muted}>
                            {i.price === undefined
                              ? "Price to confirm"
                              : money(i.price)}
                          </Text>
                        </View>
                        {!!i.url && (
                          <IconButton
                            name="external-link"
                            label={`Open product page for ${i.name}`}
                            onPress={() => {
                              void run(() => Linking.openURL(i.url!));
                            }}
                          />
                        )}
                        <IconButton
                          name="check"
                          label={`Mark ${i.name} as bought`}
                          onPress={() => mutate({ ...i, owned: true })}
                        />
                      </View>
                    ))}
                    <View style={[s.between, { marginTop: 20 }]}>
                      <Text style={s.body}>Known total</Text>
                      <Text style={s.section}>
                        {money(
                          purchases.reduce((sum, i) => sum + (i.price ?? 0), 0),
                        )}
                      </Text>
                    </View>
                    {purchases.some((i) => i.price === undefined) && (
                      <Text style={s.muted}>
                        Excludes pieces without a price.
                      </Text>
                    )}
                  </>
                )}
                <View style={s.rule} />
                <Text style={s.muted}>
                  Your plan is saved as you go. You can return to the overview
                  or revisit the reveal at any time.
                </Text>
                <View style={{ gap: 10, marginTop: 16 }}>
                  <Action
                    label={store.saved ? "Save and return home" : "Saving…"}
                    disabled={!store.saved}
                    icon="check"
                    onPress={() => go("Home")}
                  />
                  <Action
                    secondary
                    label="Revisit my room reveal"
                    onPress={() => go("Reveal")}
                  />
                </View>
              </>
            )}
          </ScrollView>
        )}
        <View style={a.nav}>
          {(["Home", "Ideas", "Rooms", "Reveal", "Works"] as Tab[]).map(
            (t, i) => (
              <Pressable
                key={t}
                accessibilityRole="tab"
                accessibilityLabel={t}
                accessibilityState={{ selected: t === tab }}
                aria-selected={t === tab}
                onPress={() => go(t)}
                style={a.navItem}
              >
                <Icon
                  name={
                    (["home", "grid", "square", "aperture", "tool"] as const)[i]
                  }
                  colour={t === tab ? c.accent : c.muted}
                />
                <Text
                  style={{
                    fontSize: 11,
                    marginTop: 6,
                    color: t === tab ? c.accent : c.muted,
                  }}
                >
                  {t}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      </View>
      {(sheet === "newroom" || sheet === "measure") && (
        <RoomForm
          savedRoomIds={project.rooms.map((r) => r.id)}
          room={sheet === "measure" ? room : undefined}
          onClose={close}
          onSave={(r) => {
            const accepted = update((p) => ({
              ...p,
              rooms:
                sheet === "measure"
                  ? p.rooms.map((v) => (v.id === r.id ? r : v))
                  : [...p.rooms, r],
              activeRoomId: r.id,
            }));
            if (!accepted) return false;
            close();
            setSelected(null);
            setTab(sheet === "measure" ? "Rooms" : "Ideas");
            return true;
          }}
        />
      )}
      {(sheet === "door" ||
        (sheet === "furniture" && piece?.kind === "door")) &&
        room && (
          <DoorForm
            room={room}
            item={sheet === "furniture" ? piece : undefined}
            onClose={close}
            onSave={(f) => {
              updateRoom(room.id, (r) => ({
                ...r,
                items: r.items.some((i) => i.id === f.id)
                  ? r.items.map((i) => (i.id === f.id ? f : i))
                  : [...r.items, f],
              }));
              setSelected(f.id);
              close();
            }}
          />
        )}
      {sheet === "furniture" && room && piece?.kind !== "door" && (
        <FurnitureForm
          room={room}
          item={piece}
          initialSpecify={tab === "Reveal"}
          onClose={close}
          onSave={(f) => {
            updateRoom(room.id, (r) => ({
              ...r,
              items: piece
                ? r.items.map((i) => (i.id === f.id ? f : i))
                : [...r.items, f],
            }));
            setSelected(f.id);
            close();
          }}
        />
      )}
      {sheet === "idea" && idea && room && (
        <IdeaForm
          idea={idea}
          onClose={close}
          onSave={(v) => {
            updateRoom(room.id, (r) => ({
              ...r,
              ideas: r.ideas.some((i) => i.id === v.id)
                ? r.ideas.map((i) => (i.id === v.id ? v : i))
                : [...r.ideas, v],
            }));
            close();
          }}
          onDelete={() => {
            updateRoom(room.id, (r) => ({
              ...r,
              ideas: r.ideas.filter((i) => i.id !== idea.id),
            }));
            close();
          }}
        />
      )}
      {sheet === "brief" && room && (
        <RoomBriefForm
          room={room}
          onClose={close}
          onSave={(changed) => {
            updateRoom(room.id, () => changed);
            close();
          }}
        />
      )}
      {sheet === "work" && room && (
        <Sheet title="One thing at a time" onClose={close}>
          <Field
            label="Task name"
            value={draft}
            onChangeText={setDraft}
            maxLength={200}
          />
          <Action
            label="Save"
            disabled={!draft.trim()}
            onPress={() => {
              updateRoom(room.id, (r) => ({
                ...r,
                works: [
                  ...r.works,
                  { id: newId(), title: draft.trim(), done: false },
                ],
              }));
              close();
            }}
          />
        </Sheet>
      )}
      {sheet === "choose" && (
        <Sheet title="Your rooms" onClose={close}>
          {project.rooms.map((r) => (
            <View key={r.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Action
                  secondary
                  label={r.name + (r.sample ? " (example)" : "")}
                  onPress={() => {
                    update((p) => ({ ...p, activeRoomId: r.id }));
                    setSelected(null);
                    close();
                  }}
                />
              </View>
              <IconButton
                name="trash-2"
                label={`Delete room: ${r.name}`}
                onPress={() => {
                  setDeleteId(r.id);
                  setSheet("delete");
                }}
              />
            </View>
          ))}
          <Action label="Add a room" onPress={() => setSheet("newroom")} />
        </Sheet>
      )}
      {sheet === "roomoptions" && room && (
        <Sheet title="Room details" onClose={close}>
          <Action
            secondary
            label="Edit measurements"
            onPress={() => setSheet("measure")}
          />
          {piece && (
            <Action
              secondary
              label={`Remove ${piece.name}`}
              onPress={() => {
                updateRoom(room.id, (r) => ({
                  ...r,
                  items: r.items.filter((i) => i.id !== piece.id),
                }));
                setSelected(null);
                close();
              }}
            />
          )}
          <Action
            secondary
            label="Choose another room"
            onPress={() => setSheet("choose")}
          />
          <Action
            secondary
            label="Delete this room"
            onPress={() => {
              setDeleteId(room.id);
              setSheet("delete");
            }}
          />
        </Sheet>
      )}
      {sheet === "delete" && deletingRoom && (
        <Sheet title={`Delete ${deletingRoom.name}?`} onClose={close}>
          <Text style={s.body}>
            This removes the room, its pictures and its lists. You can undo it
            during this session.
          </Text>
          <Action
            label="Delete room"
            onPress={() => {
              update((p) => {
                const rooms = p.rooms.filter((r) => r.id !== deletingRoom.id);
                return {
                  ...p,
                  rooms,
                  activeRoomId:
                    p.activeRoomId === deletingRoom.id
                      ? (rooms[0]?.id ?? null)
                      : p.activeRoomId,
                };
              });
              close();
              setTab("Home");
            }}
          />
          <Action secondary label="Keep room" onPress={close} />
        </Sheet>
      )}
      {sheet === "conversation" && room && (
        <ConversationPanel room={room} onClose={close} />
      )}
      {sheet === "household-work" && (
        <Sheet title="Household work and shopping" onClose={close}>
          <HouseholdWork />
        </Sheet>
      )}
      {sheet === "settings" && (
        <Sheet title="Your Hometaking" onClose={close}>
          <Eyebrow>YOUR ROOMS AND HOUSEHOLD</Eyebrow>
          <AccountPanel />
          <ImportPanel />
          <Action
            secondary
            label="Household work and shopping"
            onPress={() => setSheet("household-work")}
          />
          <Text style={s.body}>
            Your rooms, pictures and lists are saved on this device and, in the
            local preview, copied to the project server. Export a backup before
            clearing your browser or reinstalling the app.
          </Text>
          <Text style={s.muted}>
            {store.syncing
              ? "Syncing"
              : store.cloudSaved
                ? "Saved to household"
                : store.serverSaved
                  ? "Saved on this device and local server"
                  : store.saved
                    ? "Saved on this device only"
                    : "Saving changes…"}
          </Text>
          <Action
            secondary
            icon="download"
            label="Export backup"
            disabled={busy}
            onPress={() => {
              void run(() => exportProject(project));
            }}
          />
          <Action
            secondary
            icon="upload"
            label="Restore backup"
            disabled={busy}
            onPress={() => {
              void run(async () => {
                const p = await importProject();
                if (p) {
                  setPending(p);
                  setSheet("restore");
                }
              });
            }}
          />
          <Action
            secondary
            label="Undo last change"
            disabled={!store.canUndo}
            onPress={store.undo}
          />

          <Text style={s.muted}>
            RoomPlan capture requires a supported physical iOS device. Reviewed
            measurements feed the planner. Automatic Blender rendering remains a
            later milestone.
          </Text>
          {!!notice && <Text style={s.error}>{notice}</Text>}
        </Sheet>
      )}
      {sheet === "restore" && pending && (
        <Sheet title="Restore this backup?" onClose={close}>
          <Text style={s.body}>
            Replace your current project with {pending.rooms.length} rooms from
            this backup? Export your current project first if you want to keep
            both.
          </Text>
          <Action
            label="Replace with backup"
            onPress={() => {
              update(() => pending);
              setSelected(null);
              setPending(null);
              close();
              setTab("Home");
            }}
          />
          <Action secondary label="Cancel" onPress={close} />
        </Sheet>
      )}
    </SafeAreaView>
  );
}
const a = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: c.line,
  },
  top: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  brand: {
    fontFamily: displayFont,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -1.4,
    color: c.ink,
  },
  content: { padding: 24, paddingTop: 30, paddingBottom: 40 },
  hero: { width: "100%", height: 245 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  selection: {
    padding: 16,
    backgroundColor: "#EDECE5",
    borderTopWidth: 1,
    borderColor: c.line,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: c.line,
    paddingVertical: 12,
    backgroundColor: c.paper,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
});
