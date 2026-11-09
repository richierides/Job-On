import React, { useState } from "react";
import { Text, View, Platform } from "react-native";
import { Room } from "../model";
import { Action, Field, Sheet, s } from "../ui";
import { RoomPlan } from "../RoomPlan";
import { useProject } from "../store";
import { cloud } from "./cloud";
import {
  applyProposal,
  planningRoom,
  Proposal,
  roomRevision,
} from "./proposals";
export function ConversationPanel({
  room,
  onClose,
}: {
  room: Room;
  onClose: () => void;
}) {
  const store = useProject(),
    [message, setMessage] = useState(""),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [preview, setPreview] = useState<Room | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const history = room.conversation ?? [];
  async function ask() {
    setBusy(true);
    setError("");
    try {
      const { data } = await cloud.auth.getSession();
      if (!data.session)
        throw new Error(
          "Sign in through Project settings to use the layout assistant.",
        );
      const root =
        process.env.EXPO_PUBLIC_API_URL ??
        (Platform.OS === "web" ? window.location.origin : "");
      if (!root)
        throw new Error("The app needs its Hometaking API address configured.");
      const res = await fetch(
        root.replace(/\/$/, "") + "/api/hometaking/propose",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({
            room: planningRoom(room),
            message,
            history: history.slice(-18),
          }),
          signal: AbortSignal.timeout(60000),
        },
      );
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error ?? "Could not create a proposal.");
      const next = applyProposal(room, result);
      setProposal(result);
      setPreview(next);
      store.update(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) =>
            r.id === room.id
              ? {
                  ...r,
                  conversation: [
                    ...(r.conversation ?? []),
                    { role: "user" as const, content: message },
                    { role: "assistant" as const, content: result.reply },
                  ].slice(-40),
                }
              : r,
          ),
        }),
        false,
      );
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const stale = proposal && roomRevision(room) !== proposal.revision;
  return (
    <Sheet title={`Discuss ${room.name}`} onClose={onClose}>
      <Text style={s.body}>
        Describe who uses the room, what it needs to do and how it should feel.
        Proposals remain separate until you apply them.
      </Text>
      {history.slice(-8).map((m, i) => (
        <Text key={i} style={m.role === "user" ? s.body : s.muted}>
          {m.content}
        </Text>
      ))}
      <Field
        label="Your message"
        multiline
        value={message}
        onChangeText={setMessage}
        placeholder="Propose a layout, and explain the choices."
      />
      <Action
        label={busy ? "Considering the layout…" : "Ask for a proposal"}
        disabled={busy || !message.trim()}
        onPress={() => void ask()}
      />
      {proposal && preview && (
        <View style={{ gap: 12 }}>
          <Text style={s.section}>Proposed layout</Text>
          <RoomPlan
            room={preview}
            selectedId={null}
            onSelect={() => {}}
            onMove={() => {}}
          />
          {proposal.reasons.map((r, i) => (
            <Text key={i} style={s.body}>
              {r}
            </Text>
          ))}
          {proposal.uncertainties.map((r, i) => (
            <Text key={i} style={s.muted}>
              Check: {r}
            </Text>
          ))}
          <Text style={s.muted}>
            Unknown heights, window levels and door swings need measurement.
            This is not a verified clearance survey.
          </Text>
          {stale && (
            <Text style={s.error}>
              The room changed. Ask for an updated proposal.
            </Text>
          )}
          <Action
            label="Apply this proposal"
            disabled={!!stale}
            onPress={() => {
              try {
                store.updateRoom(room.id, (r) => ({
                  ...applyProposal(r, proposal),
                  conversation: r.conversation,
                }));
                setProposal(null);
                setPreview(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Action
            secondary
            label="Reject proposal"
            onPress={() => {
              setProposal(null);
              setPreview(null);
            }}
          />
        </View>
      )}
      <Action
        secondary
        label="Undo last applied change"
        disabled={!store.canUndo}
        onPress={store.undo}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </Sheet>
  );
}
