import React from "react";
import { Text } from "react-native";
import { Room } from "./model";
import { s } from "./ui";
export default function RoomRender({ room }: { room: Room }) {
  return (
    <Text style={s.muted}>
      The 3D reveal for {room.name} is available in the web preview. Native
      rendering is a later milestone; your layout and product choices are saved.
    </Text>
  );
}
