import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handler } from "../amplify/data/create-collection-record/handler";
import {
  makeQr,
  parseQr,
  type CollectingEvent,
  type LabelBatch,
  type Specimen,
  type SpecimenDetail,
  type Taxon,
} from "../src/domain";

type Row = Record<string, unknown>;
const tables = new Map<string, Map<string, Row>>();
const rows = (name: string) => {
  if (!tables.has(name)) tables.set(name, new Map());
  return tables.get(name)!;
};
let failTransaction = false;
for (const name of [
  "CollectionRecord",
  "Specimen",
  "Identification",
  "Taxon",
  "LabelBatch",
])
  process.env[`${name.toUpperCase()}_TABLE`] = name;
process.env.COUNTER_TABLE_NAME = "Counter";
const owner = "user-1::test-user";
// A transactional in-memory DynamoDB double: validates every condition before committing any write.
DynamoDBDocumentClient.prototype.send = (async (command: {
  constructor: { name: string };
  input: {
    TableName: string;
    Key: { id: string };
    IndexName: string;
    ExpressionAttributeValues: Record<string, string | number>;
    TransactItems: {
      Put: {
        TableName: string;
        Item: Row & { id: string };
        ConditionExpression: string;
        ExpressionAttributeValues: Record<string, string | number>;
      };
    }[];
  };
}) => {
  const p = command.input;
  const table = rows(p.TableName);
  switch (command.constructor.name) {
    case "GetCommand":
      return { Item: table.get(p.Key.id) };
    case "QueryCommand": {
      const field =
        p.IndexName === "byEventNumber" ? "recordNumber" : "specimenId";
      const value =
        p.ExpressionAttributeValues[":n"] ?? p.ExpressionAttributeValues[":id"];
      return { Items: [...table.values()].filter((r) => r[field] === value) };
    }
    case "ScanCommand":
      return {
        Items: [...table.values()].filter(
          (r) => r.owner === p.ExpressionAttributeValues[":owner"],
        ),
      };
    case "UpdateCommand": {
      const current = Number(
        table.get(p.Key.id)?.value ?? p.ExpressionAttributeValues[":initial"],
      );
      if (current > Number(p.ExpressionAttributeValues[":max"]))
        throw new Error("Counter overflow");
      const value = current + Number(p.ExpressionAttributeValues[":count"]);
      table.set(p.Key.id, { id: p.Key.id, value });
      return { Attributes: { value } };
    }
    case "TransactWriteCommand": {
      if (failTransaction) {
        failTransaction = false;
        throw new Error("simulated connection loss before commit");
      }
      for (const item of p.TransactItems) {
        const put = item.Put;
        const existing = rows(put.TableName).get(put.Item.id);
        if (
          put.ConditionExpression === "attribute_not_exists(id)" &&
          existing
        ) {
          const e = new Error("Conditional failure");
          e.name = "TransactionCanceledException";
          throw e;
        }
        if (
          put.ConditionExpression === "#owner = :owner" &&
          existing?.owner !== put.ExpressionAttributeValues[":owner"]
        )
          throw new Error("Forbidden");
      }
      for (const item of p.TransactItems)
        rows(item.Put.TableName).set(
          item.Put.Item.id,
          structuredClone(item.Put.Item),
        );
      return {};
    }
    default:
      throw new Error(command.constructor.name);
  }
}) as typeof DynamoDBDocumentClient.prototype.send;
const call = (action: string, p: Row, user = "user-1") =>
  handler({
    arguments: { action, payload: { ...p } },
    identity: {
      sub: user,
      username: user === "user-1" ? "test-user" : "other",
    },
  });
const eventInput = {
  localityJapaneseFull: "愛知県名古屋市",
  localityJapaneseShort: "名古屋市",
  localityRomaji: "Nagoya",
  date: "2026-09-29",
  collector: "Collector",
  memo: "",
  method: "",
};
async function setup() {
  const event = (await call("createEvent", {
    ...eventInput,
    requestId: "event-request-001",
  })) as CollectingEvent;
  const batch = (await call("reserveLabels", {
    eventNumber: event.eventNumber,
    count: 3,
    requestId: "batch-request-001",
  })) as LabelBatch;
  return { event, batch };
}
beforeEach(() => {
  tables.clear();
  failTransaction = false;
});
test("QR stays a string; 16/14-digit and legacy forms round-trip, malformed values fail", () => {
  assert.deepEqual(parseQr(makeQr(99999999, 99999999)), {
    eventNumber: 99999999,
    specimenNumber: 99999999,
  });
  assert.deepEqual(parseQr("00000200000103"), {
    eventNumber: 2,
    specimenNumber: 103,
  });
  assert.deepEqual(parseQr("CE:00000002;SP:00000103"), {
    eventNumber: 2,
    specimenNumber: 103,
  });
  for (const value of [
    "2",
    "0000000000000103",
    "0000000200000000",
    "00000002abcdefgh",
    "1e15000000000000",
  ])
    assert.throws(() => parseQr(value));
});
test("label allocation creates no specimens, records event ownership, retries reuse batch", async () => {
  const { event, batch } = await setup();
  assert.equal(rows("Specimen").size, 0);
  assert.equal(rows("Identification").size, 0);
  assert.equal(
    rows("Counter").get(`issued:${batch.firstNumber}`)?.eventId,
    event.id,
  );
  const retry = await call("reserveLabels", {
    eventNumber: event.eventNumber,
    count: 3,
    requestId: "batch-request-001",
  });
  assert.deepEqual(retry, batch);
  assert.equal(rows("LabelBatch").size, 1);
  const others = (await Promise.all([
    call("reserveLabels", {
      eventNumber: event.eventNumber,
      count: 2,
      requestId: "batch-request-002",
    }),
    call("reserveLabels", {
      eventNumber: event.eventNumber,
      count: 2,
      requestId: "batch-request-003",
    }),
  ])) as LabelBatch[];
  assert.notEqual(others[0].firstNumber, others[1].firstNumber);
});
test("unidentified specimens are allowed; duplicate and wrong event registrations are rejected", async () => {
  const { event, batch } = await setup();
  const p = {
    eventNumber: event.eventNumber,
    specimenNumber: batch.firstNumber,
    sex: "unknown",
    identification: {},
    requestId: "specimen-request-001",
  };
  const specimen = (await call("registerSpecimen", p)) as Specimen;
  assert.equal(rows("Identification").size, 0);
  assert.equal(specimen.collectingEventId, event.id);
  assert.deepEqual(await call("registerSpecimen", p), specimen);
  await assert.rejects(
    call("registerSpecimen", { ...p, requestId: "specimen-request-002" }),
  );
  const event2 = (await call("createEvent", {
    ...eventInput,
    requestId: "event-request-002",
  })) as CollectingEvent;
  await assert.rejects(
    call("registerSpecimen", {
      ...p,
      eventNumber: event2.eventNumber,
      specimenNumber: batch.firstNumber + 1,
      requestId: "specimen-request-003",
    }),
  );
  await assert.rejects(
    call("registerSpecimen", {
      ...p,
      specimenNumber: 999,
      requestId: "specimen-request-004",
    }),
  );
});
test("initial identification and specimen commit atomically; retry after failed transaction creates one", async () => {
  const { event, batch } = await setup();
  const p = {
    eventNumber: event.eventNumber,
    specimenNumber: batch.firstNumber,
    identification: { scientificName: "Graphium sarpedon" },
    requestId: "specimen-request-001",
  };
  failTransaction = true;
  await assert.rejects(call("registerSpecimen", p));
  assert.equal(rows("Specimen").size, 0);
  assert.equal(rows("Identification").size, 0);
  await call("registerSpecimen", p);
  await call("registerSpecimen", p);
  assert.equal(rows("Specimen").size, 1);
  assert.equal(rows("Identification").size, 1);
});
test("reidentification appends history and dictionary corrections cannot rewrite it", async () => {
  const { event, batch } = await setup();
  const specimen = (await call("registerSpecimen", {
    eventNumber: event.eventNumber,
    specimenNumber: batch.firstNumber,
    identification: { japaneseName: "旧名" },
    requestId: "specimen-request-001",
  })) as Specimen;
  const taxon = (await call("saveTaxon", {
    scientificName: "Original name",
    japaneseName: "旧名",
    requestId: "taxon-request-001",
  })) as Taxon;
  await call("addIdentification", {
    specimenId: specimen.id,
    scientificName: "New name",
    identifiedAt: "2020-01-01",
    requestId: "identification-request-001",
  });
  await call("saveTaxon", {
    id: taxon.id,
    scientificName: "Corrected name",
    requestId: "taxon-request-002",
  });
  const detail = (await call("lookupSpecimen", {
    specimenNumber: specimen.specimenNumber,
  })) as SpecimenDetail;
  assert.equal(detail.history.length, 2);
  assert.equal(detail.history[0].scientificName, "New name");
  assert.equal(detail.history[1].japaneseName, "旧名");
  await assert.rejects(
    call("addIdentification", {
      specimenId: specimen.id,
      requestId: "identification-request-002",
    }),
  );
});
test("ownership is enforced for reads, allocation, writes and replay; input dates are validated", async () => {
  const { event, batch } = await setup();
  await assert.rejects(
    call("findEvent", { eventNumber: event.eventNumber }, "other-user"),
  );
  await assert.rejects(
    call(
      "reserveLabels",
      {
        eventNumber: event.eventNumber,
        count: 1,
        requestId: "batch-request-004",
      },
      "other-user",
    ),
  );
  await assert.rejects(
    call("createEvent", {
      ...eventInput,
      date: "2026-02-30",
      requestId: "event-request-002",
    }),
  );
  await assert.rejects(
    call("reserveLabels", {
      eventNumber: event.eventNumber,
      count: 81,
      requestId: "batch-request-004",
    }),
  );
  await assert.rejects(
    call("reserveLabels", {
      eventNumber: event.eventNumber,
      count: 4,
      requestId: "batch-request-001",
    }),
  );
  const specimen = (await call("registerSpecimen", {
    eventNumber: event.eventNumber,
    specimenNumber: batch.firstNumber,
    requestId: "specimen-request-001",
  })) as Specimen;
  await assert.rejects(
    call(
      "lookupSpecimen",
      { specimenNumber: specimen.specimenNumber },
      "other-user",
    ),
  );
  await assert.rejects(
    call(
      "addIdentification",
      {
        specimenId: specimen.id,
        japaneseName: "名前",
        requestId: "identification-request-001",
      },
      "other-user",
    ),
  );
  assert.equal(rows("CollectionRecord").values().next().value?.owner, owner);
});
test("legacy event IDs and numbers remain readable; duplicate legacy numbers are an error", async () => {
  rows("CollectionRecord").set("old-id", {
    id: "old-id",
    recordNumber: 2,
    location: "旧採集地",
    date: "2020-01-01",
    collector: "A",
    owner,
  });
  const event = (await call("findEvent", {
    eventNumber: 2,
  })) as CollectingEvent;
  assert.equal(event.id, "old-id");
  assert.equal(event.eventNumber, 2);
  rows("CollectionRecord").set("duplicate", {
    id: "duplicate",
    recordNumber: 2,
    owner,
  });
  await assert.rejects(call("findEvent", { eventNumber: 2 }), /重複/);
});

test("three label locality lines survive event save, lookup, list and label snapshot", async () => {
  const lines = {
    localityRomaji_1: "JAPAN, Aichi Pref.",
    localityRomaji_2: "Nagoya-shi",
    localityRomaji_3: "Atsuta-ku",
  };
  const event = (await call("createEvent", {
    ...eventInput,
    ...lines,
    requestId: "three-lines-event-001",
  })) as CollectingEvent;
  const stored = rows("CollectionRecord").get(event.id)!;
  assert.equal(stored.locationRomaji, eventInput.localityRomaji);
  for (const [key, value] of Object.entries(lines))
    assert.equal(stored[key], value);
  const reloaded = (await call("findEvent", {
    eventNumber: event.eventNumber,
  })) as CollectingEvent;
  assert.deepEqual(reloaded, event);
  const page = (await call("list", { model: "CollectionRecord" })) as {
    items: CollectingEvent[];
  };
  assert.deepEqual(page.items[0], event);
  const batch = (await call("reserveLabels", {
    eventNumber: event.eventNumber,
    count: 1,
    requestId: "three-lines-batch-001",
  })) as LabelBatch;
  for (const key of Object.keys(lines) as (keyof typeof lines)[]) {
    assert.equal(reloaded[key], lines[key]);
    assert.equal(batch.snapshot[key], lines[key]);
  }
});

test("blank middle line is preserved and old records without the fields remain readable", async () => {
  const event = (await call("createEvent", {
    ...eventInput,
    localityRomaji_1: "First line",
    localityRomaji_2: "",
    localityRomaji_3: "Third line",
    requestId: "optional-lines-event-001",
  })) as CollectingEvent;
  const reloaded = (await call("findEvent", {
    eventNumber: event.eventNumber,
  })) as CollectingEvent;
  assert.equal(reloaded.localityRomaji_1, "First line");
  assert.equal(reloaded.localityRomaji_2, "");
  assert.equal(reloaded.localityRomaji_3, "Third line");
  rows("CollectionRecord").set("old-lines-id", {
    id: "old-lines-id",
    recordNumber: 2,
    location: "旧採集地",
    locationRomaji: "Original locality",
    date: "2020-01-01",
    collector: "A",
    owner,
  });
  const old = (await call("findEvent", { eventNumber: 2 })) as CollectingEvent;
  assert.equal(old.id, "old-lines-id");
  assert.equal(old.localityRomaji, "Original locality");
  assert.equal(old.localityRomaji_1, "");
  assert.equal(old.localityRomaji_2, "");
  assert.equal(old.localityRomaji_3, "");
});

test("legacy registration mutation persists all three optional lines and still accepts old callers", async () => {
  const args = {
    location: "採集地",
    locationLabel: "地名",
    locationRomaji: "Full locality",
    latitude: 35,
    longitude: 137,
    altitude: 10,
    date: "2026-09-29",
    collector: "A",
    collectingMethod: "灯火",
  };
  for (const lines of [
    {
      localityRomaji_1: "First",
      localityRomaji_2: "Second",
      localityRomaji_3: "Third",
    },
    {},
  ]) {
    const result = (await handler({
      info: { fieldName: "registerCollectionRecord" },
      identity: { sub: "user-1", username: "test-user" },
      arguments: { ...args, ...lines },
    })) as Row;
    const reloaded = (await call("findEvent", {
      eventNumber: result.recordNumber,
    })) as CollectingEvent;
    assert.equal(reloaded.id, result.id);
    assert.equal(reloaded.localityRomaji, args.locationRomaji);
    assert.equal(reloaded.localityRomaji_1, lines.localityRomaji_1 ?? "");
    assert.equal(reloaded.localityRomaji_2, lines.localityRomaji_2 ?? "");
    assert.equal(reloaded.localityRomaji_3, lines.localityRomaji_3 ?? "");
  }
});

test("server rounds new coordinates to four decimals and altitude to whole metres", async () => {
  const result = (await call("createEvent", {
    ...eventInput,
    latitude: 35.1234567,
    longitude: -136.987654,
    altitude: 10.123456,
    requestId: "coordinate-round-001",
  })) as CollectingEvent;
  const reloaded = (await call("findEvent", {
    eventNumber: result.eventNumber,
  })) as CollectingEvent;
  assert.equal(reloaded.latitude, 35.1235);
  assert.equal(reloaded.longitude, -136.9877);
  assert.equal(reloaded.altitude, 10);
  await assert.rejects(
    call("createEvent", {
      ...eventInput,
      latitude: 90.00001,
      requestId: "coordinate-invalid-001",
    }),
  );
});
