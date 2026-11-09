import { Project } from "../model";
import { canonical } from "./importer";
// Undo only the records touched by this edit. Preserve unrelated remote updates.
export function undoChange(
  current: Project,
  before: Project,
  after: Project,
): Project {
  const changed = new Set(
    [...before.rooms, ...after.rooms]
      .map((r) => r.id)
      .filter(
        (id) =>
          canonical(before.rooms.find((r) => r.id === id)) !==
          canonical(after.rooms.find((r) => r.id === id)),
      ),
  );
  for (const id of changed)
    if (
      canonical(current.rooms.find((r) => r.id === id)) !==
      canonical(after.rooms.find((r) => r.id === id))
    )
      throw new Error(
        "This room changed since that edit. Its newer version is preserved.",
      );
  const tasksChanged =
    canonical(before.householdTasks) !== canonical(after.householdTasks);
  if (
    tasksChanged &&
    canonical(current.householdTasks) !== canonical(after.householdTasks)
  )
    throw new Error("Household tasks changed since that edit.");
  const rooms = current.rooms.filter((r) => !changed.has(r.id));
  for (const r of before.rooms) if (changed.has(r.id)) rooms.push(r);
  return {
    ...current,
    rooms,
    householdTasks: tasksChanged
      ? before.householdTasks
      : current.householdTasks,
  };
}
