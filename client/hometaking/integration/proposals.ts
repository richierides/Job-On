import { z } from "zod";
import { Room, roomSchema, itemSchema, issues, outside } from "../model";
import { canonical } from "./importer";
const point = z.number().finite().min(-3000).max(6000);
export const actionSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("move"),
      id: z.string(),
      x: point,
      y: point,
      rotation: z.number().min(0).max(359),
    })
    .strict(),
  z.object({ op: z.literal("add"), item: itemSchema }).strict(),
  z.object({ op: z.literal("remove"), id: z.string() }).strict(),
]);
export const proposalSchema = z
  .object({
    reply: z.string().min(1).max(5000),
    reasons: z.array(z.string().max(1000)).max(30),
    uncertainties: z.array(z.string().max(1000)).max(30),
    actions: z.array(actionSchema).max(40),
  })
  .strict();
export type Proposal = z.infer<typeof proposalSchema> & {
  roomId: string;
  revision: string;
};
export function planningRoom(room: Room): Room {
  return {
    ...room,
    conversation: undefined,
    visualCaptures: undefined,
    updatedAt: "",
    imported: undefined,
    ideas: room.ideas.map((i) => ({ ...i, image: "sample:room" })),
    items: room.items.map((i) => ({ ...i, image: undefined })),
    structure: room.structure
      ? {
          ...room.structure,
          history: [],
          current: {
            ...room.structure.current,
            original: room.structure.current.original
              ? { ...room.structure.current.original, raw: "" }
              : undefined,
          },
        }
      : undefined,
  };
}
export const roomRevision = (room: Room) => canonical(planningRoom(room));
export function applyProposal(room: Room, proposal: Proposal): Room {
  if (room.id !== proposal.roomId || roomRevision(room) !== proposal.revision)
    throw new Error(
      "The room changed after this proposal. Ask for an updated proposal.",
    );
  let items = room.items.map((i) => ({ ...i }));
  const touched = new Set<string>();
  for (const a of proposalSchema.parse({
    reply: proposal.reply,
    reasons: proposal.reasons,
    uncertainties: proposal.uncertainties,
    actions: proposal.actions,
  }).actions) {
    if (a.op === "add") {
      if (!["furniture", "rug", "shelf"].includes(a.item.kind))
        throw new Error(
          "Architecture can only be corrected in measurement review.",
        );
      if (items.some((i) => i.id === a.item.id))
        throw new Error("A proposed item ID already exists.");
      items.push({
        ...a.item,
        owned: false,
        dimensionsConfirmed: false,
        stage: "layout",
        url: undefined,
        image: undefined,
        price: undefined,
      });
      touched.add(a.item.id);
      continue;
    }
    const item = items.find((i) => i.id === a.id);
    if (!item) throw new Error("A proposed item no longer exists.");
    if (!["furniture", "rug", "shelf"].includes(item.kind))
      throw new Error(
        "Fixed features cannot be moved or removed by conversation.",
      );
    touched.add(a.id);
    if (a.op === "remove") items = items.filter((i) => i.id !== a.id);
    else
      items = items.map((i) =>
        i.id === a.id ? { ...i, x: a.x, y: a.y, rotation: a.rotation } : i,
      );
  }
  const next = roomSchema.parse({ ...room, items });
  for (const item of items)
    if (touched.has(item.id) && outside(item, next))
      throw new Error(
        `${item.name} would be outside the room. Nothing was applied.`,
      );
  const before = new Set(issues(room).map(canonical));
  const errors = issues(next).filter(
    (i) => i.ids.some((id) => touched.has(id)) && !before.has(canonical(i)),
  );
  if (errors.length) throw new Error(errors.map((e) => e.message).join(" "));
  return next;
}
