import { additiveImport } from "./integration/importer";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Project, parseProject } from "./model";
const ID = "@hometaking/server-plan-id/v1";
const REV = "@hometaking/server-plan-revision/v1";
let revision: string | null = null;
let id: string | null = null;
export const hasLocalPlanServer = () =>
  Platform.OS === "web" &&
  typeof location !== "undefined" &&
  ["127.0.0.1", "localhost"].includes(location.hostname);
async function identity() {
  if (!id) {
    id = await AsyncStorage.getItem(ID);
    if (!id) {
      id = crypto.randomUUID();
      await AsyncStorage.setItem(ID, id);
    }
  }
  return id;
}
export async function loadServerPlan(local: Project | null) {
  const planId = await identity();
  revision = await AsyncStorage.getItem(REV);
  const response = await fetch(`/api/plans/${planId}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) {
    revision = null;
    return local;
  }
  if (!response.ok) throw new Error("Could not read server plan");
  const remote = await response.json();
  const project = parseProject(JSON.stringify(remote.project));
  if (
    local &&
    revision !== remote.revision &&
    JSON.stringify(local) !== JSON.stringify(project)
  ) {
    const appended = additiveImport(local, project);
    if (appended) {
      revision = remote.revision;
      await AsyncStorage.setItem(REV, revision!);
      return appended;
    }
    throw new Error(
      "Another session has saved a different version. Your browser copy is preserved.",
    );
  }
  revision = remote.revision;
  await AsyncStorage.setItem(REV, revision!);
  return local ?? project;
}
export async function saveServerPlan(project: Project) {
  const planId = await identity();
  const response = await fetch(`/api/plans/${planId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, revision }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "Another session saved a different version. Your browser copy is safe; reload to check the conflict."
        : "Local server save failed.",
    );
  revision = (await response.json()).revision;
  await AsyncStorage.setItem(REV, revision!);
}

export async function savedRenderUrl(roomId: string) {
  return `/api/plans/${await identity()}/rooms/${encodeURIComponent(roomId)}/render`;
}
