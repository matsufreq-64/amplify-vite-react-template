import { test } from "node:test";
import assert from "node:assert/strict";
import { eventSummariesForSpecimens } from "../src/specimenEvents";
import type { CollectingEvent, Specimen } from "../src/domain";

const specimen = (id: string, eventId: string): Specimen => ({
  id,
  specimenNumber: Number(id),
  collectingEventId: eventId,
  sex: "unexamined",
  memo: "",
});
const event = (id: string): CollectingEvent => ({
  id,
  eventNumber: Number(id.slice(1)),
  localityJapaneseFull: `${id}の採集地`,
  localityJapaneseShort: "",
  localityRomaji: "",
  date: "2026-10-10",
  collector: "",
  method: "",
  memo: "",
});

test("specimen search resolves collecting place and date across event pages, reusing known events", async () => {
  const calls: (string | null | undefined)[] = [];
  const events = await eventSummariesForSpecimens(
    [specimen("1", "e1"), specimen("2", "e2"), specimen("3", "e3")],
    { e1: event("e1") },
    async (cursor) => {
      calls.push(cursor);
      return cursor
        ? { items: [event("e3")], cursor: null }
        : { items: [event("e2")], cursor: "next" };
    },
  );
  assert.deepEqual(calls, [undefined, "next"]);
  assert.equal(events.e1.localityJapaneseFull, "e1の採集地");
  assert.equal(events.e2.date, "2026-10-10");
  assert.equal(events.e3.localityJapaneseFull, "e3の採集地");
  await eventSummariesForSpecimens([specimen("4", "e2")], events, async () => {
    throw new Error("cached events should not be fetched again");
  });
});
