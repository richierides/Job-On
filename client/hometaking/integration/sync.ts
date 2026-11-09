import { canonical } from "./importer";
export type Document = {
  id: string;
  kind: "room" | "tasks";
  payload: unknown;
  revision: string;
  deleted: boolean;
};
export type Baseline = Record<
  string,
  { revision: string; payload: unknown; deleted: boolean }
>;
export type SyncConflict = { id: string; local: unknown; remote: Document };
// Pure three-way comparison. Compare content, not clocks or device timestamps.
export function reconcile(
  local: Record<string, unknown>,
  base: Baseline,
  remote: Document[],
) {
  const writes: {
    id: string;
    payload: unknown;
    expected: string | null;
    deleted: boolean;
  }[] = [];
  const merged = { ...local };
  const conflicts: SyncConflict[] = [];
  const remotes = new Map(remote.map((d) => [d.id, d]));
  for (const id of new Set([
    ...Object.keys(local),
    ...Object.keys(base),
    ...remotes.keys(),
  ])) {
    const b = base[id],
      r = remotes.get(id),
      l = local[id];
    const localChanged = b
      ? canonical(l) !== canonical(b.deleted ? undefined : b.payload)
      : l !== undefined;
    const remoteChanged = b ? r?.revision !== b.revision : !!r;
    const remotePayload = r?.deleted ? undefined : r?.payload;
    if (
      localChanged &&
      remoteChanged &&
      canonical(l) !== canonical(remotePayload)
    ) {
      conflicts.push({
        id,
        local: l,
        remote: r ?? {
          id,
          kind: id === "__tasks__" ? "tasks" : "room",
          payload: null,
          revision: "",
          deleted: true,
        },
      });
      continue;
    }
    if (localChanged && canonical(l) !== canonical(remotePayload))
      writes.push({
        id,
        payload: l ?? b?.payload ?? {},
        expected: r?.revision ?? null,
        deleted: l === undefined,
      });
    else if (remoteChanged) {
      if (remotePayload === undefined) delete merged[id];
      else merged[id] = remotePayload;
    }
  }
  return { writes, merged, conflicts };
}
