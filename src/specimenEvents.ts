import type { CollectingEvent, Specimen } from "./domain";
import type { Page } from "./api/workflow";

export async function eventSummariesForSpecimens(
  specimens: Specimen[],
  known: Record<string, CollectingEvent>,
  fetchPage: (cursor?: string | null) => Promise<Page<CollectingEvent>>,
) {
  const events = { ...known };
  const pending = new Set(
    specimens.map((specimen) => specimen.collectingEventId)
      .filter((id) => !events[id]),
  );
  if (!pending.size) return events;
  let cursor: string | null | undefined;
  do {
    const page = await fetchPage(cursor);
    for (const event of page.items) {
      if (pending.delete(event.id)) events[event.id] = event;
    }
    cursor = page.cursor;
  } while (pending.size && cursor);
  return events;
}
