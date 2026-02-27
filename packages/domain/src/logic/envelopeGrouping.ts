import type { Envelope } from "../models/Envelope";
import type { EnvelopeGroup } from "../models/EnvelopeGroup";

export type GroupedEnvelopes = {
  group: EnvelopeGroup;
  envelopes: Envelope[];
};

const UNGROUPED_GROUP: EnvelopeGroup = {
  id: "__ungrouped__",
  name: "Ungrouped",
  sortOrder: Number.MAX_SAFE_INTEGER,
};

export function groupEnvelopes(
  envelopes: Envelope[],
  groups: EnvelopeGroup[],
): GroupedEnvelopes[] {
  const groupIds = new Set(groups.map((g) => g.id));
  const sorted = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);

  const buckets = new Map<string, Envelope[]>();
  for (const g of sorted) {
    buckets.set(g.id, []);
  }

  const ungrouped: Envelope[] = [];

  for (const env of envelopes) {
    if (env.groupId && groupIds.has(env.groupId)) {
      buckets.get(env.groupId)!.push(env);
    } else {
      ungrouped.push(env);
    }
  }

  const result: GroupedEnvelopes[] = sorted.map((g) => ({
    group: g,
    envelopes: buckets.get(g.id)!,
  }));

  if (ungrouped.length > 0) {
    result.push({ group: UNGROUPED_GROUP, envelopes: ungrouped });
  }

  return result;
}

export function reorderGroups(
  groups: EnvelopeGroup[],
  orderedIds: string[],
): EnvelopeGroup[] {
  const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
  const inOrder: EnvelopeGroup[] = [];
  const rest: EnvelopeGroup[] = [];

  for (const g of groups) {
    if (orderMap.has(g.id)) {
      inOrder.push(g);
    } else {
      rest.push(g);
    }
  }

  inOrder.sort((a, b) => orderMap.get(a.id)! - orderMap.get(b.id)!);

  return [...inOrder, ...rest].map((g, i) => ({ ...g, sortOrder: i }));
}
