import React, { useState } from "react";
import { View, Text } from "react-native";
import { Action, Field, s } from "../ui";
import { useProject } from "../store";
import { newId, money } from "../model";
export function HouseholdWork() {
  const { project, update } = useProject(),
    [title, setTitle] = useState("");
  const tasks = project.householdTasks ?? [];
  const change = (id: string, patch: Partial<(typeof tasks)[number]>) =>
    update((p) => ({
      ...p,
      version: 2,
      householdTasks: (p.householdTasks ?? []).map((t) =>
        t.id === id
          ? { ...t, ...patch, updatedAt: new Date().toISOString() }
          : t,
      ),
    }));
  const move = (index: number, delta: number) =>
    update((p) => {
      const t = [...(p.householdTasks ?? [])];
      if (index + delta < 0 || index + delta >= t.length) return p;
      [t[index], t[index + delta]] = [t[index + delta], t[index]];
      return {
        ...p,
        version: 2,
        householdTasks: t.map((v, i) => ({ ...v, position: i })),
      };
    });
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.section}>Household tasks</Text>
      <Text style={s.muted}>
        Shared across rooms. Imported comments are kept as written; earlier
        decisions may need review.
      </Text>
      {tasks.map((t, i) => (
        <View key={t.id} style={{ gap: 6 }}>
          <Action
            secondary
            label={`${t.done ? "Done" : "To do"}: ${t.title}`}
            onPress={() => change(t.id, { done: !t.done })}
          />
          <Field
            label="Task comment"
            defaultValue={t.comment}
            multiline
            onEndEditing={(e) => change(t.id, { comment: e.nativeEvent.text })}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Action
              secondary
              label="Earlier"
              disabled={i === 0}
              onPress={() => move(i, -1)}
            />
            <Action
              secondary
              label="Later"
              disabled={i === tasks.length - 1}
              onPress={() => move(i, 1)}
            />
          </View>
        </View>
      ))}
      <Field label="New household task" value={title} onChangeText={setTitle} />
      <Action
        label="Add household task"
        disabled={!title.trim()}
        onPress={() => {
          update((p) => ({
            ...p,
            version: 2,
            householdTasks: [
              ...(p.householdTasks ?? []),
              {
                id: newId(),
                title: title.trim(),
                comment: "",
                done: false,
                position: (p.householdTasks ?? []).length,
              },
            ],
          }));
          setTitle("");
        }}
      />
      <Text style={s.section}>Shopping across rooms</Text>
      {project.rooms.map((r) => (
        <View key={r.id} style={{ gap: 6 }}>
          <Text style={s.body}>{r.name}</Text>
          {r.items
            .filter((i) => ["furniture", "rug", "shelf"].includes(i.kind))
            .map((i) => (
              <Action
                key={i.id}
                secondary
                label={`${i.owned ? "Owned" : "To buy"}: ${i.name}, ${i.width} × ${i.depth} cm${i.price !== undefined ? ", " + money(i.price) : ""}`}
                onPress={() =>
                  update((p) => ({
                    ...p,
                    rooms: p.rooms.map((x) =>
                      x.id === r.id
                        ? {
                            ...x,
                            items: x.items.map((it) =>
                              it.id === i.id ? { ...it, owned: !it.owned } : it,
                            ),
                          }
                        : x,
                    ),
                  }))
                }
              />
            ))}
        </View>
      ))}
    </View>
  );
}
