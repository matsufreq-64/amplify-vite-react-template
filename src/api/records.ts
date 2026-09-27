import type { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';
import type { CollectionRecord } from '../types';

const client = generateClient<Schema>();

function checkErrors(errors: readonly { message: string }[] | undefined) {
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join('\n'));
  }
}

function toCollectionRecord(
  item: Schema['CollectionRecord']['type']
): CollectionRecord {
  return {
    id: item.recordNumber,
    cloudId: item.id,
    location: item.location,
    locationRomaji: item.locationRomaji,
    latitude: item.latitude,
    longitude: item.longitude,
    altitude: item.altitude,
    date: item.date,
    collector: item.collector,
    collectingMethod: item.collectingMethod,
  };
}

export async function loadCollectionRecords(): Promise<CollectionRecord[]> {
  const records: CollectionRecord[] = [];
  let nextToken: string | null | undefined;

  do {
    const result = await client.models.CollectionRecord.list({
      authMode: 'userPool',
      limit: 1000,
      nextToken,
    });
    checkErrors(result.errors);
    records.push(...result.data.map(toCollectionRecord));
    nextToken = result.nextToken;
  } while (nextToken);

  return records.sort((a, b) => a.id - b.id);
}

export async function saveCollectionRecord(
  record: Omit<CollectionRecord, "id" | "cloudId">
): Promise<CollectionRecord> {
const { data, errors } =
  await client.mutations.registerCollectionRecord(
    {
        location: record.location,
        locationRomaji: record.locationRomaji,
        latitude: record.latitude,
        longitude: record.longitude,
        altitude: record.altitude,
        date: record.date,
        collector: record.collector,
        collectingMethod: record.collectingMethod,
    },
    { authMode: "userPool" }
  );

  checkErrors(errors);
  if (!data) throw new Error("保存結果を取得できませんでした。");

  return toCollectionRecord(data);
}

export async function removeCollectionRecord(cloudId: string): Promise<void> {
  const { errors } = await client.models.CollectionRecord.delete(
    { id: cloudId },
    { authMode: "userPool" }
  );
  checkErrors(errors);
}