import { undoChange } from "./integration/history";
import {
  readLocal,
  writeLocal,
  readDocument,
  writeDocument,
} from "./integration/local";
import {
  cloud,
  readDocuments,
  documentsProject,
  syncHousehold,
  ConflictError,
  Household,
} from "./integration/cloud";
import { Baseline, SyncConflict } from "./integration/sync";
import { canonical } from "./integration/importer";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { initialProject, parseProject, Project, Room } from "./model";

import {
  hasLocalPlanServer,
  loadServerPlan,
  saveServerPlan,
} from "./planStorage";

type Store = {
  project: Project;
  household: Household | null;
  cloudSaved: boolean;
  syncing: boolean;
  conflicts: SyncConflict[];
  connect: (h: Household, includeLocal: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
  resolveConflict: (id: string, choice: "remote" | "both") => void;
  loading: boolean;
  error: string;
  saved: boolean;
  serverSaved: boolean;
  update: (fn: (p: Project) => Project, recordHistory?: boolean) => boolean;
  updateRoom: (id: string, fn: (r: Room) => Room) => void;
  undo: () => void;
  canUndo: boolean;
  retry: () => void;
  reload: () => void;
};
const Context = createContext<Store | null>(null);
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [project, setProject] = useState<Project>({
    version: 1,
    rooms: [],
    activeRoomId: null,
  });
  const [household, setHousehold] = useState<Household | null>(null),
    [cloudSaved, setCloudSaved] = useState(false),
    [syncing, setSyncing] = useState(false),
    [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const binding = useRef<{
    household: Household;
    userId: string;
    base: Baseline;
  } | null>(null);
  const [serverSaved, setServerSaved] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(true),
    [historySize, setHistorySize] = useState(0);
  const current = useRef(project),
    history = useRef<{ before: Project; after: Project }[]>([]),
    queue = useRef(Promise.resolve()),
    revision = useRef(0),
    readFailed = useRef(false);
  const load = async () => {
    setLoading(true);
    try {
      const raw = await readLocal();
      const config = await readDocument("cloud-binding");
      if (config) {
        const b = JSON.parse(config);
        if (b) {
          binding.current = b;
          setHousehold(b.household);
        }
      }
      let p = raw ? parseProject(raw) : null;
      let syncError = "";
      if (!binding.current && hasLocalPlanServer()) {
        try {
          p = await loadServerPlan(p);
        } catch (e) {
          syncError =
            e instanceof Error ? e.message : "Local server unavailable.";
        }
      }
      p = p ?? initialProject();
      current.current = p;
      setProject(p);
      readFailed.current = false;
      setError(
        syncError
          ? `${syncError} Saved on this device only. Retry saving when the server is available.`
          : "",
      );
      if (!syncError) persist(p);
    } catch {
      readFailed.current = true;
      setError(
        "Your saved project could not be opened. Retry before editing so it is not overwritten.",
      );
    } finally {
      setLoading(false);
    }
  };
  const initialLoad = useRef(load);
  useEffect(() => {
    void initialLoad.current();
  }, []);
  const syncNow = async (
    snapshot: Project = current.current,
    version = revision.current,
  ) => {
    const b = binding.current;
    if (!b) return;
    setSyncing(true);
    try {
      const { data, error } = await cloud.auth.getUser();
      if (error || data.user?.id !== b.userId)
        throw new Error("Sign in again to sync. Your device copy is safe.");
      const result = await syncHousehold(snapshot, b.household.id, b.base);
      if (binding.current !== b) return;
      b.base = result.base;
      await writeDocument("cloud-binding", JSON.stringify(b));
      await writeDocument(
        `household-${b.household.id}-${b.userId}`,
        JSON.stringify({
          project:
            version === revision.current ? result.project : current.current,
          base: b.base,
        }),
      );
      if (version === revision.current) {
        current.current = result.project;
        setProject(result.project);
        await writeLocal(JSON.stringify(result.project));
        setCloudSaved(true);
        setConflicts([]);
        setError("");
      }
    } catch (e) {
      if (e instanceof ConflictError) setConflicts(e.conflicts);
      throw e;
    } finally {
      setSyncing(false);
    }
  };
  const sync = async () => {
    queue.current = queue.current
      .then(() => syncNow())
      .catch((e) => setError("Saved on this device. " + (e as Error).message));
    await queue.current;
  };
  const connect = async (h: Household, includeLocal: boolean) => {
    await queue.current;
    const { data, error } = await cloud.auth.getUser();
    if (error || !data.user) throw new Error("Sign in first.");
    const remote = await readDocuments(h.id);
    const base: Baseline = {};
    const docs: Record<string, unknown> = {};
    remote.forEach((d) => {
      base[d.id] = {
        revision: d.revision,
        payload: d.payload,
        deleted: d.deleted,
      };
      if (!d.deleted) docs[d.id] = d.payload;
    });
    let next = documentsProject(docs, current.current.activeRoomId);
    const savedDraft = await readDocument(`household-${h.id}-${data.user.id}`);
    if (savedDraft) {
      const draft = JSON.parse(savedDraft);
      next = parseProject(JSON.stringify(draft.project));
      Object.keys(base).forEach((k) => delete base[k]);
      Object.assign(base, draft.base);
    }
    if (includeLocal) {
      const rooms = [...next.rooms];
      for (const r of current.current.rooms) {
        const existing = rooms.find((x) => x.id === r.id);
        if (existing && canonical(existing) === canonical(r)) continue;
        rooms.push(existing ? { ...r, id: r.id + "-local-" + Date.now() } : r);
      }
      next = {
        ...next,
        rooms,
        householdTasks: [
          ...(next.householdTasks ?? []),
          ...(current.current.householdTasks ?? []).map((t) => ({
            ...t,
            id: t.id + "-local-" + Date.now(),
          })),
        ],
      };
    }
    next = parseProject(JSON.stringify(next));
    if (!binding.current)
      await writeDocument("before-cloud", JSON.stringify(current.current));
    if (binding.current)
      await writeDocument(
        `household-${binding.current.household.id}-${binding.current.userId}`,
        JSON.stringify({
          project: current.current,
          base: binding.current.base,
        }),
      );
    binding.current = { household: h, userId: data.user.id, base };
    await writeDocument("cloud-binding", JSON.stringify(binding.current));
    setHousehold(h);
    history.current = [];
    setHistorySize(0);
    current.current = next;
    setProject(next);
    persist(next);
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => {
    const timer = setInterval(() => {
      if (binding.current) void syncRef.current();
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const disconnect = async () => {
    await queue.current;
    if (binding.current)
      await writeDocument(
        `household-${binding.current.household.id}-${binding.current.userId}`,
        JSON.stringify({
          project: current.current,
          base: binding.current.base,
        }),
      );
    binding.current = null;
    setHousehold(null);
    setCloudSaved(false);
    setConflicts([]);
    await writeDocument("cloud-binding", "null");
    const previous = await readDocument("before-cloud");
    if (previous) {
      const p = parseProject(previous);
      current.current = p;
      setProject(p);
      persist(p);
    }
  };
  const resolveConflict = (id: string, choice: "remote" | "both") => {
    const conflict = conflicts.find((c) => c.id === id),
      b = binding.current;
    if (!conflict || !b) return;
    b.base[id] = {
      revision: conflict.remote.revision,
      payload: conflict.remote.payload,
      deleted: conflict.remote.deleted,
    };
    update((p) => {
      if (id === "__tasks__")
        return {
          ...p,
          householdTasks: [
            ...(conflict.remote.deleted
              ? []
              : (conflict.remote.payload as NonNullable<
                  Project["householdTasks"]
                >)),
            ...(choice === "both"
              ? (p.householdTasks ?? []).map((t) => ({
                  ...t,
                  id: t.id + "-local-" + Date.now(),
                }))
              : []),
          ],
        };
      const local = p.rooms.find((r) => r.id === id);
      return {
        ...p,
        rooms: [
          ...p.rooms.filter((r) => r.id !== id),
          ...(conflict.remote.deleted ? [] : [conflict.remote.payload as Room]),
          ...(choice === "both" && local
            ? [
                {
                  ...local,
                  id: local.id + "-local-" + Date.now(),
                  name: local.name + " (device version)",
                },
              ]
            : []),
        ],
      };
    });
    setConflicts((cs) => cs.filter((c) => c.id !== id));
  };
  const persist = (p: Project) => {
    const version = ++revision.current;
    setSaved(false);
    setServerSaved(false);
    setCloudSaved(false);
    queue.current = queue.current.then(async () => {
      try {
        const raw = JSON.stringify(p);
        if (raw.length > 100_000_000) throw new Error("storage limit");
        await writeLocal(raw);
        if (binding.current)
          await writeDocument(
            `household-${binding.current.household.id}-${binding.current.userId}`,
            JSON.stringify({ project: p, base: binding.current.base }),
          );
        if (version === revision.current) setSaved(true);
        if (!binding.current && hasLocalPlanServer()) {
          try {
            await saveServerPlan(p);
            if (version === revision.current) setServerSaved(true);
          } catch (e) {
            if (version === revision.current) {
              setSaved(true);
              setError(
                `Saved on this device only. ${e instanceof Error ? e.message : "Local server unavailable."} Retry saving to keep the server copy up to date.`,
              );
            }
            return;
          }
        }
        if (binding.current) await syncNow(p, version);
        if (version === revision.current) {
          setSaved(true);
          setError("");
        }
      } catch (e) {
        if (version === revision.current)
          setError(
            `Saved status needs attention: ${e instanceof Error ? e.message : "Could not save"}. Retry or export a backup.`,
          );
      }
    });
  };
  const update = (fn: (p: Project) => Project, recordHistory = true) => {
    if (readFailed.current) return false;
    const candidate = fn(current.current);
    if (candidate === current.current) return true;
    const p: Project = { ...candidate, version: 2 };
    if (JSON.stringify(p).length > 100_000_000) {
      setError(
        "This change would exceed the 100 MB portable project limit. Export a backup and reduce picture sizes before trying again. Nothing was changed.",
      );
      return false;
    }
    try {
      parseProject(JSON.stringify(p));
    } catch {
      setError(
        "This change could not be validated. Check measurements and the limits: 50 rooms, 100 pieces, 30 pictures, 200 tasks and 20 capture revisions per room.",
      );
      return false;
    }
    if (recordHistory) {
      history.current = [
        ...history.current.slice(-19),
        { before: current.current, after: p },
      ];
      setHistorySize(history.current.length);
    }
    current.current = p;
    setProject(p);
    persist(p);
    return true;
  };
  const undo = () => {
    const entry = history.current[history.current.length - 1];
    if (!entry) return;
    try {
      const previous = undoChange(current.current, entry.before, entry.after);
      history.current.pop();
      setHistorySize(history.current.length);
      current.current = previous;
      setProject(previous);
      persist(previous);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Context.Provider
      value={{
        project,
        household,
        cloudSaved,
        syncing,
        conflicts,
        connect,
        disconnect,
        sync,
        resolveConflict,
        loading,
        error,
        saved,
        serverSaved,
        update,
        updateRoom: (id, fn) =>
          update((p) => ({
            ...p,
            rooms: p.rooms.map((r) =>
              r.id === id
                ? { ...fn(r), updatedAt: new Date().toISOString() }
                : r,
            ),
          })),
        undo,
        canUndo: historySize > 0,
        retry: () => {
          if (readFailed.current) void load();
          else persist(current.current);
        },
        reload: () => {
          void load();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProject() {
  const value = useContext(Context);
  if (!value) throw new Error("ProjectProvider required");
  return value;
}
