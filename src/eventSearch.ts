import type { CollectingEvent } from "./domain";

export type EventSearch = { locality: string; date: string };
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().trim();
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
  return [...found.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.eventNumber - a.eventNumber,
  );
}
