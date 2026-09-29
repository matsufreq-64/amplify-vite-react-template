import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID, createHash } from "node:crypto";
import { numberValue, type CollectingEvent } from "../../../src/domain";

type Row = Record<string, unknown>;
type Request = {
  arguments: { action?: string; payload?: unknown } & Row;
  identity?: { sub?: string; username?: string };
  info?: { fieldName?: string };
};
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const table = (name: string) => {
  const value =
    process.env[
      name === "Counter" ? "COUNTER_TABLE_NAME" : `${name.toUpperCase()}_TABLE`
    ];
  if (!value) throw new Error("バックエンドのテーブル設定がありません。");
  return value;
};
const text = (p: Row, key: string, required = false) => {
  const value = p[key];
  if (value !== undefined && value !== null && typeof value !== "string")
    throw new Error(`${key}: 文字列を入力してください。`);
  const result = (value as string | undefined)?.trim() ?? "";
  if ((required && !result) || result.length > 4000)
    throw new Error(`${key}: 入力内容を確認してください。`);
  return result;
};
const num = (p: Row, key: string) => numberValue(p[key] as number);
function date(p: Row, key: string, required = false) {
  const value = text(p, key, required);
  if (
    value &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value)
  )
    throw new Error("日付を確認してください。");
  return value;
}
function optionalNumber(p: Row, key: string, min = -Infinity, max = Infinity) {
  if (p[key] === undefined || p[key] === null || p[key] === "")
    return undefined;
  const n = p[key];
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
    throw new Error(`${key}: 数値の範囲を確認してください。`);
  return n;
}
const get = async (model: string, id: string) =>
  (
    await db.send(
      new GetCommand({
        TableName: table(model),
        Key: { id },
        ConsistentRead: true,
      }),
    )
  ).Item;
const owned = (row: Row | undefined, owner: string) => {
  if (!row || (row.owner !== owner && row.owner !== owner.split("::")[0]))
    throw new Error("対象のデータが見つかりません。");
  return row;
};
function eventView(r: Row): CollectingEvent {
  return {
    id: String(r.id),
    eventNumber: Number(r.recordNumber),
    localityJapaneseFull: String(r.location),
    localityJapaneseShort: String(r.locationLabel ?? ""),
    localityRomaji: String(r.locationRomaji ?? ""),
    localityRomaji_1: String(r.localityRomaji_1 ?? ""),
    localityRomaji_2: String(r.localityRomaji_2 ?? ""),
    localityRomaji_3: String(r.localityRomaji_3 ?? ""),
    latitude: r.latitude as number | undefined,
    longitude: r.longitude as number | undefined,
    altitude: r.altitude as number | undefined,
    date: String(r.date),
    collector: String(r.collector),
    method: String(r.collectingMethod ?? ""),
    memo: String(r.memo ?? ""),
  };
}
async function eventByNumber(n: number, owner: string) {
  // A strongly consistent mapping serves newly issued numbers; the GSI handles historical records.
  const mapping = await get("Counter", `event:${n}`);
  if (mapping)
    return owned(await get("CollectionRecord", String(mapping.eventId)), owner);
  let key: Row | undefined;
  const rows: Row[] = [];
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: table("CollectionRecord"),
        IndexName: "byEventNumber",
        KeyConditionExpression: "recordNumber = :n",
        ExpressionAttributeValues: { ":n": n },
        ExclusiveStartKey: key,
      }),
    );
    rows.push(...(result.Items ?? []));
    key = result.LastEvaluatedKey;
  } while (key);
  if (rows.length > 1)
    throw new Error(
      "採集イベント番号が重複しています。管理者によるデータ確認が必要です。",
    );
  return owned(rows[0], owner);
}
async function allocate(key: string, count: number, initial = 0) {
  const result = await db.send(
    new UpdateCommand({
      TableName: table("Counter"),
      Key: { id: key },
      UpdateExpression: "SET #v = if_not_exists(#v, :initial) + :count",
      ConditionExpression: "attribute_not_exists(#v) OR #v <= :max",
      ExpressionAttributeNames: { "#v": "value" },
      ExpressionAttributeValues: {
        ":initial": initial,
        ":count": count,
        ":max": 99999999 - count,
      },
      ReturnValues: "UPDATED_NEW",
    }),
  );
  return Number(result.Attributes?.value);
}
const put = (model: string, item: Row) => ({
  Put: {
    TableName: table(model),
    Item: item,
    ConditionExpression: "attribute_not_exists(id)",
  },
});
function identification(p: Row) {
  return {
    japaneseName: text(p, "japaneseName"),
    scientificName: text(p, "scientificName"),
    identifiedAt: date(p, "identifiedAt") || undefined,
    identifiedBy: text(p, "identifiedBy"),
    memo: text(p, "memo"),
  };
}
async function history(id: string, owner: string) {
  const rows: Row[] = [];
  let key: Row | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: table("Identification"),
        IndexName: "bySpecimenHistory",
        KeyConditionExpression: "specimenId = :id",
        ExpressionAttributeValues: { ":id": id },
        ExclusiveStartKey: key,
      }),
    );
    rows.push(
      ...(result.Items ?? []).filter(
        (r) => r.owner === owner || r.owner === owner.split("::")[0],
      ),
    );
    key = result.LastEvaluatedKey;
  } while (key);
  return rows.sort((a, b) => Number(b.sequence) - Number(a.sequence));
}
export async function handler(request: Request) {
  if (!request.identity?.sub || !request.identity.username)
    throw new Error("ログインが必要です。");
  const owner = `${request.identity.sub}::${request.identity.username}`;
  const legacy = request.info?.fieldName === "registerCollectionRecord";
  const action = legacy ? "createEvent" : request.arguments.action;
  const raw = request.arguments.payload;
  const p: Row = legacy
    ? {
        ...request.arguments,
        localityJapaneseFull: request.arguments.location,
        localityJapaneseShort: request.arguments.locationLabel,
        localityRomaji: request.arguments.locationRomaji,
        method: request.arguments.collectingMethod,
        requestId: randomUUID(),
      }
    : typeof raw === "string"
      ? JSON.parse(raw)
      : ((raw ?? {}) as Row);
  const now = new Date().toISOString();
  const base = (id: string = randomUUID()) => ({
    id,
    owner,
    createdAt: now,
    updatedAt: now,
  });
  if (action === "findEvent")
    return eventView(await eventByNumber(num(p, "eventNumber"), owner));
  if (action === "lookupSpecimen") {
    const n = num(p, "specimenNumber");
    const lock = await get("Counter", `specimen:${n}`);
    const specimen = lock
      ? owned(await get("Specimen", String(lock.specimenId)), owner)
      : null;
    const event = specimen
      ? owned(
          await get("CollectionRecord", String(specimen.collectingEventId)),
          owner,
        )
      : await eventByNumber(num(p, "eventNumber"), owner);
    if (p.eventNumber && Number(p.eventNumber) !== event.recordNumber)
      throw new Error("QRの採集イベント番号と登録済み標本が一致しません。");
    const issue = await get("Counter", `issued:${n}`);
    return {
      event: eventView(event),
      specimen,
      history: specimen ? await history(String(specimen.id), owner) : [],
      issued: !!issue && issue.eventId === event.id && issue.owner === owner,
    };
  }
  if (action === "list") {
    const model = text(p, "model");
    if (
      !["CollectionRecord", "Specimen", "LabelBatch", "Taxon"].includes(model)
    )
      throw new Error("対象が不正です。");
    const key = p.cursor
      ? JSON.parse(Buffer.from(text(p, "cursor"), "base64url").toString())
      : undefined;
    const result = await db.send(
      new ScanCommand({
        TableName: table(model),
        Limit: 60,
        ExclusiveStartKey: key,
        FilterExpression: "#owner = :owner OR #owner = :sub",
        ExpressionAttributeNames: { "#owner": "owner" },
        ExpressionAttributeValues: {
          ":owner": owner,
          ":sub": request.identity.sub,
        },
      }),
    );
    return {
      items:
        model === "CollectionRecord"
          ? (result.Items?.map(eventView) ?? [])
          : (result.Items ?? []).map((r) =>
              model === "LabelBatch"
                ? {
                    ...r,
                    snapshot:
                      typeof r.snapshot === "string"
                        ? JSON.parse(r.snapshot)
                        : r.snapshot,
                  }
                : r,
            ),
      cursor: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
            "base64url",
          )
        : null,
    };
  }
  // Durable idempotency: the result and every domain write commit together.
  const requestId = text(p, "requestId", true);
  if (!/^[\w-]{8,80}$/.test(requestId))
    throw new Error("リクエストIDが不正です。");
  const receiptId = `request:${owner}:${requestId}`;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ action, p }))
    .digest("hex");
  const previous = await get("Counter", receiptId);
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new Error(
        "同じ送信IDで異なる内容を保存できません。内容を再確認してください。",
      );
    return previous.result;
  }
  let result: unknown;
  const writes: NonNullable<TransactWriteCommandInput["TransactItems"]> = [];
  if (action === "createEvent") {
    const fields = {
      location: text(p, "localityJapaneseFull", true),
      locationLabel: text(p, "localityJapaneseShort"),
      locationRomaji: text(p, "localityRomaji"),
      localityRomaji_1: text(p, "localityRomaji_1"),
      localityRomaji_2: text(p, "localityRomaji_2"),
      localityRomaji_3: text(p, "localityRomaji_3"),
      latitude: optionalNumber(p, "latitude", -90, 90),
      longitude: optionalNumber(p, "longitude", -180, 180),
      altitude: optionalNumber(p, "altitude"),
      date: date(p, "date", true),
      collector: text(p, "collector", true),
      collectingMethod: text(p, "method"),
      memo: text(p, "memo"),
    };
    const n = await allocate("collection-record", 1, 3);
    // Existing values must never be silently reused, even if a legacy counter was misconfigured.
    const duplicate = await db.send(
      new QueryCommand({
        TableName: table("CollectionRecord"),
        IndexName: "byEventNumber",
        KeyConditionExpression: "recordNumber = :n",
        ExpressionAttributeValues: { ":n": n },
        Limit: 1,
      }),
    );
    if (duplicate.Items?.length)
      throw new Error(
        "既存番号と衝突しました。カウンターの初期値を確認してください。",
      );
    const row = { ...base(), ...fields, recordNumber: n };
    writes.push(
      put("CollectionRecord", row),
      put("Counter", { id: `event:${n}`, eventId: row.id }),
    );
    result = legacy ? row : eventView(row);
  } else if (action === "reserveLabels") {
    const event = await eventByNumber(num(p, "eventNumber"), owner);
    const count = Number(p.count);
    if (!Number.isInteger(count) || count < 1 || count > 80)
      throw new Error("一度の発行枚数は1〜80枚です。");
    const last = await allocate("specimen-number", count);
    const row = {
      ...base(),
      collectingEventId: event.id,
      eventNumber: event.recordNumber,
      firstNumber: last - count + 1,
      count,
      snapshot: JSON.stringify(eventView(event)),
    };
    writes.push(put("LabelBatch", row));
    for (let n = row.firstNumber; n <= last; n++)
      writes.push(
        put("Counter", {
          id: `issued:${n}`,
          eventId: event.id,
          batchId: row.id,
          owner,
        }),
      );
    result = { ...row, snapshot: eventView(event) };
  } else if (action === "registerSpecimen") {
    const event = await eventByNumber(num(p, "eventNumber"), owner);
    const n = num(p, "specimenNumber");
    const issue = owned(await get("Counter", `issued:${n}`), owner);
    if (issue.eventId !== event.id)
      throw new Error("この標本番号は指定イベント向けに発行されていません。");
    const sex = text(p, "sex");
    if (!["", "male", "female", "unknown", "unexamined"].includes(sex))
      throw new Error("性別を確認してください。");
    const row = {
      ...base(),
      specimenNumber: n,
      collectingEventId: event.id,
      sex,
      memo: text(p, "memo"),
    };
    const names = identification((p.identification ?? {}) as Row);
    writes.push(
      put("Specimen", row),
      put("Counter", { id: `specimen:${n}`, specimenId: row.id }),
    );
    if (names.japaneseName || names.scientificName)
      writes.push(
        put("Identification", {
          ...base(),
          ...names,
          specimenId: row.id,
          sequence: 1,
        }),
      );
    writes.push(put("Counter", { id: `history:${row.id}`, value: 1 }));
    result = row;
  } else if (action === "addIdentification") {
    const specimen = owned(
      await get("Specimen", text(p, "specimenId", true)),
      owner,
    );
    const names = identification(p);
    if (!names.japaneseName && !names.scientificName)
      throw new Error("和名または学名を入力してください。");
    const sequence = await allocate(`history:${specimen.id}`, 1);
    const row = { ...base(), ...names, specimenId: specimen.id, sequence };
    writes.push(put("Identification", row));
    result = row;
  } else if (action === "saveTaxon") {
    const id = text(p, "id");
    const existing = id ? owned(await get("Taxon", id), owner) : undefined;
    const row: Row = {
      ...base(id || undefined),
      scientificName: text(p, "scientificName", true),
      japaneseName: text(p, "japaneseName"),
      sortOrder: optionalNumber(p, "sortOrder") ?? 0,
      descriptionYear: optionalNumber(p, "descriptionYear", 1, 9999),
    };
    if (
      row.descriptionYear !== undefined &&
      !Number.isInteger(row.descriptionYear)
    )
      throw new Error("記載年は整数で入力してください。");
    for (const field of [
      "orderJapaneseName",
      "orderScientificName",
      "familyJapaneseName",
      "familyScientificName",
      "subfamilyJapaneseName",
      "subfamilyScientificName",
      "genusScientificName",
    ])
      row[field] = text(p, field);
    if (existing) {
      row.createdAt = existing.createdAt;
      writes.push({
        Put: {
          TableName: table("Taxon"),
          Item: row,
          ConditionExpression: "#owner = :owner",
          ExpressionAttributeNames: { "#owner": "owner" },
          ExpressionAttributeValues: { ":owner": existing.owner },
        },
      });
    } else writes.push(put("Taxon", row));
    result = row;
  } else throw new Error("未対応の操作です。");
  writes.push(put("Counter", { id: receiptId, fingerprint, result }));
  try {
    await db.send(new TransactWriteCommand({ TransactItems: writes }));
  } catch (error) {
    const committed = await get("Counter", receiptId);
    if (committed?.fingerprint === fingerprint) return committed.result;
    if (error instanceof Error && error.name === "TransactionCanceledException")
      throw new Error(
        "登録が競合しました。同じ標本番号が登録済みでないか検索して、現物を確認してください。",
      );
    throw error;
  }
  return result;
}
