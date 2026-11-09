import AsyncStorage from "@react-native-async-storage/async-storage";
import { CaptureEditor } from "./capture/CaptureEditor";
import { bedSizes, BedSizeId } from "./bedSizes";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Action, Field, Sheet, s, Icon } from "./ui";
import {
  blankRoom,
  Furniture,
  Idea,
  newId,
  place,
  Room,
  roomSchema,
  basicFurniture,
  isSpecified,
  nearestWall,
} from "./model";
import { palette as c } from "./tokens";
import { pickPicture } from "./media";

export const pictureSource = (uri?: string) =>
  uri === "sample:chair"
    ? require("../../assets/images/hometaking-chair.png")
    : uri === "sample:room"
      ? require("../../assets/images/hometaking-room.png")
      : uri
        ? { uri }
        : undefined;

type BriefDraft = {
  name: string;
  forWhom: string;
  purpose: string;
  feeling: string;
  jobs: string;
};
const draftFor = (room?: Room): BriefDraft => ({
  name: room?.name ?? "",
  forWhom: room?.forWhom ?? "",
  purpose: room?.purpose ?? "",
  feeling: room?.brief ?? "",
  jobs: "",
});
function BriefFields({
  draft,
  setDraft,
  includeJobs = false,
}: {
  draft: BriefDraft;
  setDraft: (d: BriefDraft) => void;
  includeJobs?: boolean;
}) {
  const field = (key: keyof BriefDraft) => (value: string) =>
    setDraft({ ...draft, [key]: value });
  return (
    <>
      <Field
        label="Room name"
        value={draft.name}
        onChangeText={field("name")}
        maxLength={100}
        placeholder="e.g. Arthur's bedroom"
      />
      <Field
        label="Who is this room for?"
        value={draft.forWhom}
        onChangeText={field("forWhom")}
        maxLength={300}
        placeholder="e.g. Arthur, a teenager who loves video games"
      />
      <Field
        label="What does it need to make room for?"
        value={draft.purpose}
        onChangeText={field("purpose")}
        multiline
        maxLength={1500}
        placeholder="Gaming, homework, sleeping and having mates over."
      />
      <Field
        label="How should it feel?"
        value={draft.feeling}
        onChangeText={field("feeling")}
        multiline
        maxLength={3000}
        placeholder="Comfortable and stylish. A room he'd be proud to show his mates."
      />
      {includeJobs && (
        <Field
          label="What work needs doing?"
          value={draft.jobs}
          onChangeText={field("jobs")}
          multiline
          maxLength={5000}
          placeholder={
            "One job per line, if you know them yet.\nPaint the walls\nImprove the lighting\nAdd storage"
          }
        />
      )}
    </>
  );
}
export function RoomBriefForm({
  room,
  onClose,
  onSave,
}: {
  room: Room;
  onClose: () => void;
  onSave: (r: Room) => void;
}) {
  const [draft, setDraft] = useState(() => draftFor(room));
  return (
    <Sheet title="The brief for this room" onClose={onClose}>
      <Text style={s.muted}>
        Keep the purpose and feeling together. This brief stays with you as you
        gather ideas, arrange furniture and plan the work.
      </Text>
      <BriefFields draft={draft} setDraft={setDraft} />
      <Text style={s.muted}>Your existing jobs are kept in the work plan.</Text>
      <Action
        label="Save brief"
        disabled={!draft.name.trim()}
        onPress={() =>
          onSave({
            ...room,
            name: draft.name.trim(),
            forWhom: draft.forWhom.trim(),
            purpose: draft.purpose.trim(),
            brief: draft.feeling.trim(),
          })
        }
      />
    </Sheet>
  );
}
export function RoomForm({
  room,
  onClose,
  onSave,
  savedRoomIds = [],
}: {
  room?: Room;
  onClose: () => void;
  onSave: (r: Room) => boolean;
  savedRoomIds?: string[];
}) {
  const [draft, setDraft] = useState(() => draftFor(room));
  const [base, setBase] = useState<Room | undefined>(room);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(Boolean(room));
  const savedRoomIdsKey = savedRoomIds.join(",");
  useEffect(() => {
    if (room) return;
    void AsyncStorage.getItem("@hometaking/new-room-draft/v1")
      .then((raw) => {
        if (raw) {
          const draft = roomSchema.parse(JSON.parse(raw));
          if (!savedRoomIdsKey.split(",").includes(draft.id)) setBase(draft);
        }
        setLoaded(true);
      })
      .catch(() =>
        setError(
          "Your new-room draft could not be read. Close and retry before creating another room.",
        ),
      );
  }, [room, savedRoomIdsKey]);
  const save = (next: Room) => {
    const accepted = onSave(next);
    return accepted;
  };
  return (
    <Sheet
      title={
        base ? "Capture and review the room" : "First, what is this room for?"
      }
      onClose={onClose}
    >
      {base ? (
        <CaptureEditor room={base} onSave={save} />
      ) : (
        <>
          <BriefFields draft={draft} setDraft={setDraft} includeJobs />
          {!!error && <Text style={s.error}>{error}</Text>}
          <Action
            label="Next: capture the room"
            disabled={!loaded}
            onPress={() => {
              const jobs = [
                ...new Set(
                  draft.jobs
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                ),
              ];
              if (
                !draft.name.trim() ||
                !draft.purpose.trim() ||
                jobs.length > 200 ||
                jobs.some((j) => j.length > 200)
              ) {
                setError(
                  "Give the room a name and purpose. Keep jobs below 200 characters each.",
                );
                return;
              }
              const next: Room = {
                ...blankRoom(draft.name.trim(), 400, 300, 240),
                brief: draft.feeling,
                forWhom: draft.forWhom,
                purpose: draft.purpose,
                journey: "Ideas",
                works: jobs.map((title) => ({
                  id: newId(),
                  title,
                  done: false,
                })),
              };
              void AsyncStorage.setItem(
                "@hometaking/new-room-draft/v1",
                JSON.stringify(next),
              )
                .then(() => setBase(next))
                .catch(() =>
                  setError("The room draft could not be saved. Please retry."),
                );
            }}
          />
          <Text style={s.muted}>
            The next step starts with provisional dimensions. Scan or enter your
            own measurements before applying them.
          </Text>
        </>
      )}
    </Sheet>
  );
}

export function FurnitureForm({
  room,
  item,
  onClose,
  onSave,
  initialSpecify = false,
}: {
  room: Room;
  item?: Furniture;
  initialSpecify?: boolean;
  onClose: () => void;
  onSave: (f: Furniture) => void;
}) {
  const [product, setProduct] = useState(
    initialSpecify || (item ? isSpecified(item) : false),
  );
  const [bedSize, setBedSize] = useState<BedSizeId | undefined>(item?.bedSize);
  const [bedRegion, setBedRegion] = useState<"UK" | "US">(
    item?.bedSize?.startsWith("us-") ? "US" : "UK",
  );
  const [archetype, setArchetype] = useState(item?.archetype);
  const [name, setName] = useState(item?.name ?? ""),
    [url, setUrl] = useState(item?.url ?? ""),
    [image, setImage] = useState(item?.image),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [w, setW] = useState(item ? String(item.width) : ""),
    [d, setD] = useState(item ? String(item.depth) : ""),
    [h, setH] = useState(item?.height == null ? "" : String(item.height)),
    [price, setPrice] = useState(
      item?.price === undefined ? "" : String(item.price),
    );
  const [kind, setKind] = useState<Furniture["kind"]>(
      item?.kind ?? "furniture",
    ),
    [owned, setOwned] = useState(item?.owned ?? false),
    [confirmed, setConfirmed] = useState(item?.dimensionsConfirmed ?? false),
    [colour, setColour] = useState(item?.colour ?? c.rust);
  const save = () => {
    const dims = [w, d, h].map((v) => Number(v.replace(",", "."))),
      cost = product
        ? price.trim()
          ? Number(price.replace(",", "."))
          : undefined
        : item?.price;
    if (
      !name.trim() ||
      dims.some(
        (v, i) =>
          !(i === 2 && !h.trim() && !product) &&
          (!Number.isFinite(v) || v < 1 || v > 3000),
      )
    ) {
      setError(
        "Enter a name and width, depth and height between 1 and 3,000 cm.",
      );
      return;
    }
    if (product && url.trim())
      try {
        const u = new URL(url.trim());
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        setError("Use a full product link beginning with https://.");
        return;
      }
    if (
      cost !== undefined &&
      (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000)
    ) {
      setError("Enter a valid price, or leave it blank.");
      return;
    }
    if (product && !confirmed) {
      setError("Check and confirm the dimensions before adding this piece.");
      return;
    }
    const next: Furniture = {
      id: item?.id ?? newId(),
      name: name.trim(),
      width: dims[0],
      depth: dims[1],
      height: h.trim() ? dims[2] : null,
      x: item?.x ?? room.width / 2,
      y: item?.y ?? room.depth / 2,
      rotation: item?.rotation ?? 0,
      kind,
      hinge: item?.hinge,
      owned: ["furniture", "rug", "shelf"].includes(kind) ? owned : true,
      dimensionsConfirmed: confirmed,
      stage: product ? "product" : "layout",
      archetype,
      bedSize: /bed/i.test(archetype ?? name) ? bedSize : undefined,
      colour,
      url: product ? url.trim() : item?.url,
      price: cost,
      image: product ? image : item?.image,
    };
    onSave(item ? next : place(next, next.x, next.y, room));
  };
  const pick = async () => {
    setBusy(true);
    try {
      const uri = await pickPicture();
      if (uri) setImage(uri);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={item ? "Edit this piece" : "Start with the layout"}
      onClose={onClose}
    >
      {!item && (
        <>
          <Text style={s.muted}>
            Choose a basic item, adjust its size and try it in the room. Pick
            the actual product later.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {basicFurniture.map((b) => (
              <Pressable
                key={b.name}
                accessibilityRole="button"
                accessibilityLabel={`Start with ${b.name.toLowerCase()}`}
                onPress={() => {
                  setName(b.name);
                  setArchetype(b.name);
                  setBedSize(undefined);
                  setW(String(b.width));
                  setD(String(b.depth));
                  setH(String(b.height));
                  setKind("furniture");
                  setConfirmed(false);
                }}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: name === b.name ? c.ink : c.line,
                }}
              >
                <Text style={s.body}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {!product && (
        <Text style={s.muted}>
          Planning sizes are approximate, not product measurements. Adjust them
          to allow the space you need.
        </Text>
      )}
      <Field
        label="Item name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Lounge chair"
        maxLength={100}
      />
      {/bed/i.test(archetype ?? name) && (
        <View style={{ gap: 10 }}>
          <Text style={s.label}>Bed size</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["UK", "US"] as const).map((region) => (
              <Pressable
                key={region}
                accessibilityRole="button"
                accessibilityLabel={`${region} bed sizes`}
                accessibilityState={{ selected: bedRegion === region }}
                onPress={() => setBedRegion(region)}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: bedRegion === region ? c.ink : c.line,
                }}
              >
                <Text style={s.body}>{region} sizes</Text>
              </Pressable>
            ))}
          </View>
          {bedSizes
            .filter((size) => size.region === bedRegion)
            .map((size) => (
              <Pressable
                key={size.id}
                accessibilityRole="button"
                accessibilityLabel={`${size.region} ${size.label}`}
                accessibilityState={{ selected: bedSize === size.id }}
                onPress={() => {
                  setBedSize(size.id);
                  setW(String(Math.round((size.width + 10) * 100) / 100));
                  setD(String(Math.round((size.length + 10) * 100) / 100));
                  if (!h) setH("100");
                  setConfirmed(false);
                }}
                style={{
                  padding: 12,
                  borderWidth: bedSize === size.id ? 2 : 1,
                  borderColor: bedSize === size.id ? c.ink : c.line,
                }}
              >
                <Text style={s.body}>
                  {size.label} · {size.width} × {size.length} cm
                </Text>
              </Pressable>
            ))}
          <Action
            secondary
            label="Custom bed size"
            onPress={() => setBedSize(undefined)}
          />
          <Text style={s.muted}>
            {bedSize
              ? (() => {
                  const size = bedSizes.find((v) => v.id === bedSize)!;
                  return `Selected: ${size.region} ${size.label}, mattress ${size.width} × ${size.length} cm. `;
                })()
              : "Custom or unspecified mattress size. "}
            Choosing a size sets a suggested overall footprint with 10 cm added
            to both mattress width and length for the frame. This is an
            estimate. Adjust the dimensions below to the actual bed, including
            its headboard. Depth means overall bed length; height is unchanged.
          </Text>
        </View>
      )}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="Width (cm)"
            value={w}
            onChangeText={(v) => {
              setW(v);
              setConfirmed(false);
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Depth (cm)"
            value={d}
            onChangeText={(v) => {
              setD(v);
              setConfirmed(false);
            }}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Height (cm)"
            value={h}
            onChangeText={(v) => {
              setH(v);
              setConfirmed(false);
            }}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
      {!product && (
        <>
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Action
            label={item ? "Save piece" : "Add to my room"}
            onPress={save}
          />
        </>
      )}
      <Text style={s.label}>Type of item</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            "furniture",
            "fixed",
            "rug",
            "door",
            "window",
            "socket",
            "shelf",
          ] as const
        )
          .filter(
            (k) =>
              !room.structure ||
              k === "furniture" ||
              k === "rug" ||
              k === "socket" ||
              k === "shelf",
          )
          .map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              onPress={() => setKind(k)}
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: k === kind ? c.ink : c.line,
              }}
            >
              <Text style={s.body}>
                {k === "fixed"
                  ? "Fixed feature"
                  : k[0].toUpperCase() + k.slice(1)}
              </Text>
            </Pressable>
          ))}
      </View>
      <Text style={s.label}>Plan colour</Text>
      <View style={s.row}>
        {[c.rust, c.olive, "#C6B99F", "#97AFB0", "#333333"].map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${v}`}
            onPress={() => setColour(v)}
            style={{
              width: 44,
              height: 44,
              backgroundColor: v,
              borderWidth: colour === v ? 3 : 0,
              borderColor: c.ink,
            }}
          />
        ))}
      </View>
      <Action
        secondary
        icon={product ? "chevron-up" : "plus"}
        label={
          product ? "Use as a basic layout item" : "Specify a product or photo"
        }
        onPress={() => setProduct(!product)}
      />
      {product && (
        <>
          <Text style={s.muted}>
            Attach the piece you have chosen. Its position and rotation stay the
            same; check the layout if its dimensions change.
          </Text>
          <Field
            label="Product link (optional)"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://…"
            maxLength={2000}
          />
          <Text style={s.muted}>
            Save the link, then copy the dimensions from the listing. Automatic
            product import comes later.
          </Text>
          {image && (
            <Image
              source={pictureSource(image)}
              style={{ height: 180, width: "100%" }}
              contentFit="contain"
            />
          )}
          <Action
            secondary
            icon="image"
            label={
              busy
                ? "Opening photos…"
                : image
                  ? "Change picture"
                  : "Add a photo"
            }
            onPress={() => {
              void pick();
            }}
            disabled={busy}
          />
          <Field
            label="Price in £ (optional)"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </>
      )}
      <Check
        label="I already own this"
        checked={owned}
        onPress={() => setOwned(!owned)}
      />
      {product && (
        <Check
          label="Dimensions confirmed"
          checked={confirmed}
          onPress={() => setConfirmed(!confirmed)}
        />
      )}
      {product && (
        <>
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Action
            label={item ? "Save piece" : "Add to my room"}
            onPress={save}
          />
        </>
      )}
    </Sheet>
  );
}
export function Check({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={onPress}
      style={[s.row, { minHeight: 44 }]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderWidth: 1,
          borderColor: checked ? c.accent : c.ink,
          backgroundColor: checked ? c.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Icon name="check" size={18} colour="white" />}
      </View>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
export function IdeaForm({
  idea,
  onClose,
  onSave,
  onDelete,
}: {
  idea: Idea;
  onClose: () => void;
  onSave: (v: Idea) => void;
  onDelete: () => void;
}) {
  const [role, setRole] = useState(idea.role),
    [note, setNote] = useState(idea.note);
  return (
    <Sheet title="What do you like about it?" onClose={onClose}>
      <Image
        source={pictureSource(idea.image)}
        style={{ width: "100%", height: 240 }}
        contentFit="cover"
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            "Inspiration",
            "Colour",
            "Materials",
            "Keep this",
            "Include this",
          ] as const
        ).map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            onPress={() => setRole(r)}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: r === role ? c.ink : c.line,
            }}
          >
            <Text style={s.body}>{r}</Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Your note"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="Just the colours, or the whole feeling?"
        maxLength={1000}
      />
      <Action
        label="Save idea"
        onPress={() => onSave({ ...idea, role, note })}
      />
      <Action secondary label="Remove picture" onPress={onDelete} />
    </Sheet>
  );
}

export function DoorForm({
  room,
  item,
  onClose,
  onSave,
}: {
  room: Room;
  item?: Furniture;
  onClose: () => void;
  onSave: (i: Furniture) => void;
}) {
  const [wall, setWall] = useState<NonNullable<Furniture["wall"]>>(
    item ? nearestWall(item, room) : "south",
  );
  const [width, setWidth] = useState(String(item?.width ?? 80)),
    [height, setHeight] = useState(item ? String(item.height ?? "") : "");
  const [hinge, setHinge] = useState<Furniture["hinge"]>(item?.hinge);
  const [offset, setOffset] = useState(
    String(
      item
        ? Math.max(
            0,
            (nearestWall(item, room) === "north" ||
            nearestWall(item, room) === "south"
              ? item.x
              : item.y) -
              item.width / 2,
          )
        : Math.max(0, (room.width - 80) / 2),
    ),
  );
  const [error, setError] = useState("");
  const save = () => {
    const w = Number(width),
      h = Number(height),
      o = Number(offset),
      horizontal = wall === "north" || wall === "south",
      length = horizontal ? room.width : room.depth;
    if (
      ![w, h, o].every(Number.isFinite) ||
      w < 30 ||
      (height.trim() !== "" && h < 50) ||
      (room.height !== null && h > room.height) ||
      o < 0 ||
      o + w > length
    ) {
      setError(
        "Enter a door that fits this wall: width at least 30 cm, a valid height and enough space after the offset.",
      );
      return;
    }
    const next: Furniture = {
      ...(item ?? {}),
      id: item?.id ?? newId(),
      name: item?.name ?? "Door",
      width: w,
      depth: 4,
      height: height.trim() ? h : null,
      hinge,
      x: horizontal ? o + w / 2 : wall === "west" ? 2 : room.width - 2,
      y: horizontal ? (wall === "north" ? 2 : room.depth - 2) : o + w / 2,
      rotation: horizontal ? 0 : 90,
      kind: "door",
      colour: "#C6B99F",
      owned: true,
      dimensionsConfirmed: !!height.trim(),
      wall,
    };
    onSave(next);
  };
  return (
    <Sheet
      title={item ? "Door position" : "Where is the door?"}
      onClose={onClose}
    >
      <Text style={s.muted}>
        Choose the wall as seen from above. The plan shows the opening and an a
        swing only when you record its hinge. Leave unknown heights blank.
      </Text>
      <View style={{ gap: 8 }}>
        {([undefined, "left", "right"] as const).map((v) => (
          <Action
            key={v ?? "unknown"}
            secondary
            label={`Hinge: ${v ?? "unknown"}${hinge === v ? " (selected)" : ""}`}
            onPress={() => setHinge(v)}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["north", "east", "south", "west"] as const).map((v, i) => (
          <Action
            key={v}
            secondary={v !== wall}
            label={["Top wall", "Right wall", "Bottom wall", "Left wall"][i]}
            onPress={() => setWall(v)}
          />
        ))}
      </View>
      <Field
        label="Door width (cm)"
        value={width}
        onChangeText={setWidth}
        keyboardType="decimal-pad"
      />
      <Field
        label="Door height (cm)"
        value={height}
        onChangeText={setHeight}
        keyboardType="decimal-pad"
      />
      <Field
        label={
          wall === "north" || wall === "south"
            ? "Distance from left corner (cm)"
            : "Distance from top corner (cm)"
        }
        value={offset}
        onChangeText={setOffset}
        keyboardType="decimal-pad"
      />
      <Text style={s.muted}>
        The swing is a layout guide. Check its hinge and opening direction in
        the real room.
      </Text>
      {!!error && <Text style={s.error}>{error}</Text>}
      <Action label={item ? "Save door" : "Add door"} onPress={save} />
    </Sheet>
  );
}
