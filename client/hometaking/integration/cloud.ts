import { encodeAssets, decodeAssets } from "./assets";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Project, parseProject } from "../model";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import { Baseline, Document, reconcile, SyncConflict } from "./sync";
export const cloud = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
export type Household = { id: string; name: string };
export async function households(): Promise<Household[]> {
  const { data, error } = await cloud.rpc("my_households");
  if (error) throw error;
  return data ?? [];
}
export async function sourceExport(hid: string) {
  const [rooms, tasks] = await Promise.all([
    cloud.from("rooms").select("*").eq("household_id", hid),
    cloud.from("tasks").select("*").eq("household_id", hid).order("position"),
  ]);
  if (rooms.error || tasks.error) throw rooms.error ?? tasks.error;
  return { rooms: rooms.data, tasks: tasks.data };
}
const hash = (text: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const pack = (value: unknown, hid: string) =>
  encodeAssets(value, hid, hash, async (path, text) => {
    const { error } = await cloud.storage
      .from("hometaking")
      .upload(path, text, { contentType: "text/plain", upsert: false });
    if (
      error &&
      String((error as any).statusCode) !== "409" &&
      !/already exists/i.test(error.message)
    )
      throw error;
  });
const unpack = (value: unknown, hid: string) =>
  decodeAssets(value, hid, hash, async (path) => {
    const { data, error } = await cloud.storage
      .from("hometaking")
      .createSignedUrl(path, 60);
    if (error) throw error;
    const response = await fetch(data.signedUrl);
    if (!response.ok)
      throw new Error("A photo or scan could not be downloaded.");
    return response.text();
  });
export async function readDocuments(hid: string): Promise<Document[]> {
  const { data, error } = await cloud
    .from("ht_documents")
    .select("*")
    .eq("household_id", hid);
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (d) => ({
      ...d,
      payload: await unpack(d.payload, hid),
    })),
  );
}
export function projectDocuments(p: Project): Record<string, unknown> {
  return Object.fromEntries([
    ...p.rooms.map((r) => [r.id, r]),
    ["__tasks__", p.householdTasks ?? []],
  ]);
}
export function documentsProject(
  docs: Record<string, unknown>,
  active: string | null,
): Project {
  const rooms = Object.entries(docs)
    .filter(([id]) => id !== "__tasks__")
    .map(([, v]) => v) as Project["rooms"];
  return parseProject(
    JSON.stringify({
      version: 2,
      rooms,
      householdTasks: docs.__tasks__ ?? [],
      activeRoomId: rooms.some((r) => r.id === active)
        ? active
        : (rooms[0]?.id ?? null),
    }),
  );
}
export class ConflictError extends Error {
  constructor(public conflicts: SyncConflict[]) {
    super("Another device changed the same room. Both versions are preserved.");
  }
}
export async function syncHousehold(p: Project, hid: string, base: Baseline) {
  const remote = await readDocuments(hid),
    result = reconcile(projectDocuments(p), base, remote);
  if (result.conflicts.length) throw new ConflictError(result.conflicts);
  const nextBase = { ...base };
  for (const d of remote)
    nextBase[d.id] = {
      revision: d.revision,
      payload: d.payload,
      deleted: d.deleted,
    };
  for (const w of result.writes) {
    const mutation = Crypto.randomUUID();
    const payload = await pack(w.payload, hid);
    const { error } = await cloud.rpc("ht_save_document", {
      p_household: hid,
      p_id: w.id,
      p_kind: w.id === "__tasks__" ? "tasks" : "room",
      p_payload: payload,
      p_expected: w.expected,
      p_mutation: mutation,
      p_deleted: w.deleted,
    });
    if (error) throw error;
    nextBase[w.id] = {
      revision: mutation,
      payload: w.payload,
      deleted: w.deleted,
    };
  }
  return {
    project: documentsProject(result.merged, p.activeRoomId),
    base: nextBase,
  };
}
