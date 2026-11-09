import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { Room, Furniture, isSpecified, issues } from "./model";
import { hasLocalPlanServer, savedRenderUrl } from "./planStorage";
import RoomRender from "./RoomRender";
import { VisualCapturePanel } from "./capture/VisualCapturePanel";
import { pictureSource } from "./forms";
import { Action, Heading, Eyebrow, s } from "./ui";
import { palette as c } from "./tokens";
export default function RoomReveal({
  room,
  onSpecify,
  onWallColour,
  onContinue,
}: {
  room: Room;
  onSpecify: (i: Furniture) => void;
  onWallColour: (colour: string) => void;
  onContinue: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [render, setRender] = useState<{ url: string; source: Room } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    setRender(null);
    if (hasLocalPlanServer())
      void savedRenderUrl(room.id)
        .then(async (url) => {
          const response = await fetch(`${url}/metadata`);
          if (response.ok && active) {
            const data = await response.json();
            if (active) setRender({ url, source: data.source });
          }
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [room.id]);
  const input = (r: Room) =>
    JSON.stringify([
      r.structure,
      r.width,
      r.depth,
      r.height,
      r.wallColour,
      r.brief,
      r.purpose,
      r.forWhom,
      r.ideas,
      r.items.map((i) => [
        i.id,
        i.name,
        i.width,
        i.depth,
        i.height,
        i.x,
        i.y,
        i.rotation,
        i.kind,
        i.colour,
        i.archetype,
        i.bedSize,
        i.wall,
        i.image,
        i.url,
      ]),
    ]);
  const renderCurrent = render && input(render.source) === input(room);
  const items = room.items.filter(
    (i) => i.kind === "furniture" || i.kind === "rug" || i.kind === "fixed",
  );
  if (room.structure || room.visualCaptures?.length)
    return (
      <View style={{ gap: 18 }}>
        <VisualCapturePanel room={room} />
        <Text style={s.muted}>
          The original scan and camera captures show the room as captured.
          Layout edits do not update those views.
        </Text>
        <Action label="Continue to work" onPress={onContinue} />
      </View>
    );
  if (room.height === null || room.items.some((i) => i.height === null))
    return (
      <View style={{ gap: 18 }}>
        <Heading>Measurements needed.</Heading>
        <Text style={s.body}>
          The 2D plan is saved. Room or furniture heights are still unknown, so
          a 3D preview would invent measurements. Review these before rendering.
        </Text>
        <Action label="Continue to work" onPress={onContinue} />
      </View>
    );

  return (
    <View style={{ gap: 18 }}>
      <Heading>See it come{"\n"}together.</Heading>
      <Text style={s.body}>
        Your room, with the layout you have made. Bring in real pieces, try a
        finish and look around before planning the work.
      </Text>
      {issues(room).length > 0 && (
        <Text style={s.error}>
          Check the layout:{" "}
          {issues(room)
            .map((i) => i.message)
            .slice(0, 3)
            .join(" ")}
        </Text>
      )}
      {!shown ? (
        <Action
          icon="aperture"
          label="Reveal my room"
          onPress={() => setShown(true)}
        />
      ) : (
        <>
          {render && (
            <View style={{ gap: 12 }}>
              <Eyebrow>
                {renderCurrent
                  ? "PROPOSED ROOM / BLENDER STUDY"
                  : "EARLIER BLENDER STUDY"}
              </Eyebrow>
              {!renderCurrent && (
                <Text style={s.error}>
                  Your plan has changed since this render. The image below shows
                  a proposal based on the earlier brief; the live plan remains
                  current.
                </Text>
              )}
              <Image
                source={{ uri: render.url + "/main" }}
                style={{ width: "100%", aspectRatio: 1.4 }}
                contentFit="contain"
                accessibilityLabel="Blender render of Arthur's bedroom"
              />
              <Image
                source={{ uri: render.url + "/second" }}
                style={{ width: "100%", aspectRatio: 1.4 }}
                contentFit="contain"
                accessibilityLabel="Second Blender view of Arthur's bedroom"
              />
              <Text style={s.muted}>
                A proposed arrangement within the rectangular 4.2 × 3.5 × 2.4 m
                room: door on the top wall, window on the bottom. Single bed,
                small wardrobe, desk and swivel-screen setup. Window size and
                offset, and radiator placement, are provisional; the unmeasured
                ceiling slope is omitted. Furniture changes shown here have not
                overwritten your live plan. This is a prepared Blender study,
                not automatic regeneration.
              </Text>
              <Action
                secondary
                label="Open full-size Blender render"
                onPress={() => void Linking.openURL(render.url + "/main")}
              />
              <Action
                secondary
                label="Check top-down layout"
                onPress={() => void Linking.openURL(render.url + "/plan")}
              />
              <Action
                secondary
                label="Download Blender scene"
                onPress={() => void Linking.openURL(render.url + "/scene")}
              />
              <Eyebrow>LIVE LAYOUT PREVIEW</Eyebrow>
            </View>
          )}
          <RoomRender room={room} />
          <Text style={s.muted}>
            A cutaway 3D preview using your dimensions and colours. Furniture
            shapes are approximations; product photos remain references.
          </Text>
        </>
      )}
      <View style={s.rule} />
      <Eyebrow>WALL FINISH</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          ["Warm neutral", "#E4DFD5"],
          ["Soft white", "#F0ECE3"],
          ["Muted green", "#B9C0AD"],
          ["Slate blue", "#56616B"],
        ].map(([label, colour]) => (
          <Pressable
            key={colour}
            accessibilityRole="button"
            accessibilityLabel={`Wall finish: ${label}`}
            onPress={() => onWallColour(colour)}
            style={{ minWidth: 70, alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                backgroundColor: colour,
                borderWidth: room.wallColour === colour ? 3 : 1,
                borderColor: c.ink,
              }}
            />
            <Text style={{ fontSize: 11, color: c.ink }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.rule} />
      <Text style={s.section}>The pieces in your room</Text>
      <Text style={s.muted}>
        Replace a basic item with a product link or photo. Its position stays
        fixed; update its size to check the fit.
      </Text>
      {!items.length && (
        <Text style={s.body}>
          Your room is empty. Go back to Layout to add the pieces you need.
        </Text>
      )}
      {items.map((i) => (
        <View
          key={i.id}
          style={{
            gap: 12,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderColor: c.line,
          }}
        >
          <View style={s.row}>
            {i.image && (
              <Image
                source={pictureSource(i.image)}
                style={{ width: 72, height: 72 }}
                contentFit="contain"
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.section}>{i.name}</Text>
              <Text style={s.muted}>
                {i.width} × {i.depth} × {i.height} cm
              </Text>
              <Text style={s.muted}>
                {isSpecified(i) ? "Product specified" : "Basic planning item"}
              </Text>
            </View>
          </View>
          <Action
            secondary
            label={`${isSpecified(i) ? "Edit product" : "Specify"}: ${i.name}`}
            onPress={() => onSpecify(i)}
          />
        </View>
      ))}
      <Action
        icon="arrow-right"
        label="Next: make it happen"
        onPress={onContinue}
      />
    </View>
  );
}
