import { sourceExport } from "./cloud";
import React, { useState } from "react";
import { Text, View, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import { Action, s } from "../ui";
import { useProject } from "../store";
import { applyImport, previewImport, ImportPreview } from "./importer";

export function ImportPanel() {
  const { project, update, household } = useProject();
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<string, "keep" | "copy">>({});
  async function choose() {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (pick.canceled) return;
      if ((pick.assets[0].size ?? 0) > 100_000_000)
        throw new Error("Choose an export below 100 MB.");
      const raw =
        Platform.OS === "web"
          ? await (await fetch(pick.assets[0].uri)).text()
          : await FS.readAsStringAsync(pick.assets[0].uri);
      setPreview(previewImport(JSON.parse(raw), project));
      setChoices({});
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      {household && (
        <Action
          secondary
          label="Preview original household Room Planner plans"
          onPress={() =>
            void sourceExport(household.id)
              .then((raw) => {
                setPreview(
                  previewImport(raw, project, `supabase:${household.id}`),
                );
                setChoices({});
                setError("");
              })
              .catch((e) => setError(e.message))
          }
        />
      )}
      <Action
        secondary
        label="Import Room Planner rooms and tasks"
        onPress={() => void choose()}
      />
      {preview && (
        <>
          <Text style={s.body}>
            {preview.entries.length} rooms and {preview.tasks.length} household
            tasks found. Existing rooms and references will be kept.
          </Text>
          {preview.entries.map((e, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text style={s.body}>
                {e.room.name}: {e.status}, {e.room.width} × {e.room.depth} cm,{" "}
                {e.room.items.length} items. Height unknown.
              </Text>
              {e.status === "changed" && (
                <>
                  <Action
                    secondary
                    label={`Keep current ${e.room.name}`}
                    onPress={() =>
                      setChoices({ ...choices, [e.room.id]: "keep" })
                    }
                  />
                  <Action
                    secondary
                    label={`Import separate revision of ${e.room.name}`}
                    onPress={() =>
                      setChoices({ ...choices, [e.room.id]: "copy" })
                    }
                  />
                  <Text>
                    {choices[e.room.id] ??
                      "Choose how to handle this changed source."}
                  </Text>
                </>
              )}
            </View>
          ))}
          {preview.taskChanges.map((t) => (
            <View key={t.id}>
              <Text style={s.body}>Changed task: {t.title}</Text>
              <Action
                secondary
                label="Keep current task"
                onPress={() =>
                  setChoices({ ...choices, [`task:${t.id}`]: "keep" })
                }
              />
              <Action
                secondary
                label="Add separate task revision"
                onPress={() =>
                  setChoices({ ...choices, [`task:${t.id}`]: "copy" })
                }
              />
              <Text>
                {choices[`task:${t.id}`] ??
                  "Choose how to handle this changed task."}
              </Text>
            </View>
          ))}
          <Action
            label="Add reviewed imports"
            onPress={() => {
              try {
                const fresh = applyImport(project, preview, choices);
                if (update(() => fresh)) {
                  setPreview(null);
                  setError("Imported and kept existing rooms.");
                }
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Action
            secondary
            label="Cancel import"
            onPress={() => setPreview(null)}
          />
        </>
      )}
      {!!error && <Text style={s.muted}>{error}</Text>}
    </View>
  );
}
