import type { CollectingEvent } from "./domain";

export type EventSearch = { locality: string; date: string };
export type EventSearchCondition = {
  id: number;
  field: "locality" | "date" | "eventNumber" | "collector" | "method";
  operator: "contains" | "equals" | "after" | "before";
  value: string;
};
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().trim();
export const sortEventsNewest = (events: CollectingEvent[]) =>
  [...events].sort(
    (a, b) => b.date.localeCompare(a.date) || b.eventNumber - a.eventNumber,
  );
export function matchesEventConditions(
  event: CollectingEvent,
  conditions: EventSearchCondition[],
) {
  return conditions.every(({ field, operator, value }) => {
    const term = normalize(value);
    if (!term) return true;
    const candidates = field === "locality"
      ? [
          event.localityJapaneseFull,
          event.localityJapaneseShort,
          event.localityRomaji,
          event.localityRomaji_1,
          event.localityRomaji_2,
          event.localityRomaji_3,
        ]
      : field === "eventNumber"
        ? [String(event.eventNumber), String(event.eventNumber).padStart(8, "0")]
        : [String(event[field] ?? "")];
    if (operator === "after") return field === "date" && event.date >= term;
    if (operator === "before") return field === "date" && event.date <= term;
    if (field === "eventNumber" && operator === "equals" && /^\d+$/.test(term))
      return event.eventNumber === Number(term);
    return candidates.some((candidate) =>
      operator === "equals"
        ? normalize(candidate ?? "") === term
        : normalize(candidate ?? "").includes(term),
    );
  });
}
export function matchesEvent(event: CollectingEvent, query: EventSearch) {
  const locality = normalize(query.locality);
  return (
    (!query.date || event.date === query.date) &&
    (!locality ||
      [
        event.localityJapaneseFull,
        event.localityJapaneseShort,
        event.localityRomaji,
        event.localityRomaji_1,
        event.localityRomaji_2,
        event.localityRomaji_3,
      ].some((value) => normalize(value ?? "").includes(locality)))
  );
}

// Follow every owner-filtered page, including empty pages with a continuation cursor.
export async function searchEventPages(
  query: EventSearch,
  load: (
    cursor?: string | null,
  ) => Promise<{ items: CollectingEvent[]; cursor: string | null }>,
) {
  const found = new Map<string, CollectingEvent>();
  let cursor: string | null | undefined;
  do {
    const page = await load(cursor);
    for (const event of page.items)
      if (matchesEvent(event, query)) found.set(event.id, event);
    cursor = page.cursor;
  } while (cursor);
  return sortEventsNewest([...found.values()]);
}

export async function searchEventConditions(
  conditions: EventSearchCondition[],
  load: (
    cursor?: string | null,
  ) => Promise<{ items: CollectingEvent[]; cursor: string | null }>,
  onProgress?: (count: number) => void,
) {
  const found = new Map<string, CollectingEvent>();
  let cursor: string | null | undefined;
  do {
    const page = await load(cursor);
    for (const event of page.items)
      if (matchesEventConditions(event, conditions)) found.set(event.id, event);
    onProgress?.(found.size);
    cursor = page.cursor;
  } while (cursor);
  return sortEventsNewest([...found.values()]);
}
