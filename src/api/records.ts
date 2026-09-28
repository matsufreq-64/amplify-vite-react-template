// Compatibility adapter for older consumers; the current UI uses workflow.ts and domain.ts.
import { createEvent, findEvent, listPage } from "./workflow";
import type { CollectingEvent } from "../domain";
import type { CollectionRecord } from "../types";
const adapt = (event: CollectingEvent): CollectionRecord => ({
  id: event.eventNumber,
  cloudId: event.id,
  location: event.localityJapaneseFull,
  locationLabel: event.localityJapaneseShort,
  locationRomaji: event.localityRomaji,
  latitude: event.latitude,
  longitude: event.longitude,
  altitude: event.altitude,
  date: event.date,
  collector: event.collector,
  collectingMethod: event.method,
});
export async function getCollectionRecordByNumber(number: number) {
  return adapt(await findEvent(number));
}
export async function loadCollectionRecords() {
  const page = await listPage<CollectingEvent>("CollectionRecord");
  return page.items.map(adapt);
}
export async function saveCollectionRecord(
  record: Omit<CollectionRecord, "id" | "cloudId">,
) {
  return adapt(
    await createEvent({
      localityJapaneseFull: record.location,
      localityJapaneseShort: record.locationLabel,
      localityRomaji: record.locationRomaji,
      latitude: record.latitude,
      longitude: record.longitude,
      altitude: record.altitude,
      date: record.date,
      collector: record.collector,
      method: record.collectingMethod,
      memo: "",
    }),
  );
}
export async function removeCollectionRecord(_id: string): Promise<void> {
  throw new Error(`採集イベント ${_id} の削除は参照データ保護のため無効です。`);
}
