import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FS from "expo-file-system/legacy";
const legacy = "@hometaking/local-pilot/v1";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("hometaking-durable", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("documents");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function readDocument(name: string): Promise<string | null> {
  if (Platform.OS === "web") {
    const db = await database();
    return new Promise((resolve, reject) => {
      const r = db.transaction("documents").objectStore("documents").get(name);
      r.onsuccess = () => {
        db.close();
        resolve(r.result ?? null);
      };
      r.onerror = () => {
        db.close();
        reject(r.error);
      };
    });
  }
  const slot = await AsyncStorage.getItem("@hometaking/slot/" + name);
  if (!slot) return null;
  return FS.readAsStringAsync(FS.documentDirectory + `ht-${name}-${slot}.json`);
}
export async function writeDocument(name: string, raw: string) {
  if (Platform.OS === "web") {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      tx.objectStore("documents").put(raw, name);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
    return;
  }
  const key = "@hometaking/slot/" + name,
    previous = await AsyncStorage.getItem(key),
    next = previous === "a" ? "b" : "a";
  await FS.writeAsStringAsync(
    FS.documentDirectory + `ht-${name}-${next}.json`,
    raw,
  );
  await AsyncStorage.setItem(key, next);
}
export async function readLocal() {
  const existing =
    (await readDocument("project")) ?? (await AsyncStorage.getItem(legacy));
  if (existing !== null) return existing;
  // Only a fresh native installation can initialise from the user's staged backup.
  if (Platform.OS !== "web") {
    const staged = FS.documentDirectory + "hometaking-import.json";
    if ((await FS.getInfoAsync(staged)).exists)
      return FS.readAsStringAsync(staged);
  }
  return null;
}
export async function writeLocal(raw: string) {
  await writeDocument("project", raw);
}
