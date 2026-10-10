import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesSpecimenConditions, sortSpecimensNewest } from "../src/specimenSearch";
import type { CollectingEvent, Specimen } from "../src/domain";

const event: CollectingEvent = {
  id: "event-1", eventNumber: 25, localityJapaneseFull: "愛知県豊田市", localityJapaneseShort: "豊田市",
  localityRomaji: "Toyota-shi", date: "2026-10-10", collector: "Matsubara", method: "灯火", memo: "",
};
const specimen: Specimen = {
  id: "specimen-1", specimenNumber: 85, collectingEventId: event.id, sex: "male", memo: "翅に傷",
};

test("specimen conditions combine locality, event number and memo", () => {
  assert.equal(matchesSpecimenConditions(specimen, event, [
    { id: 0, field: "locality", operator: "contains", value: "豊田" },
    { id: 1, field: "eventNumber", operator: "equals", value: "00000025" },
    { id: 2, field: "memo", operator: "contains", value: "翅" },
  ]), true);
  assert.equal(matchesSpecimenConditions(specimen, event, [
    { id: 0, field: "date", operator: "before", value: "2026-10-09" },
  ]), false);
});

test("specimen results sort by collection date, then specimen number", () => {
  const oldEvent = { ...event, id: "event-old", date: "2026-09-01" };
  const rows = sortSpecimensNewest([
    { ...specimen, id: "old", specimenNumber: 200, collectingEventId: oldEvent.id },
    specimen,
    { ...specimen, id: "same-day", specimenNumber: 90 },
  ], { [event.id]: event, [oldEvent.id]: oldEvent });
  assert.deepEqual(rows.map((row) => row.specimenNumber), [90, 85, 200]);
});
