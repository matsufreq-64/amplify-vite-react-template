import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLLECTOR,
  COLLECTOR_STORAGE_KEY,
  IDENTIFIER_STORAGE_KEY,
  USE_CURRENT_LOCATION_STORAGE_KEY,
  getDefaultCollector,
  getDefaultIdentifier,
  getUseCurrentLocation,
  initialIdentification,
  localDate,
  nextIdentification,
  roundAltitude,
  roundCoordinate,
  setDefaultCollector,
  setDefaultIdentifier,
  setUseCurrentLocation,
} from "../src/registrationDefaults";
import { emptyIdentification } from "../src/domain";
test("collector defaults and four-decimal coordinate boundaries", () => {
  assert.equal(DEFAULT_COLLECTOR, "S. Matsubara");
  assert.equal(roundCoordinate(35.1234567), 35.1235);
  assert.equal(roundCoordinate(-136.987654), -136.9877);
  assert.equal(roundCoordinate(0), 0);
  assert.equal(roundCoordinate(undefined), undefined);
});

test("altitude rounds to whole metres and collector setting persists with fallback", () => {
  assert.equal(roundAltitude(123.49), 123);
  assert.equal(roundAltitude(123.5), 124);
  assert.equal(roundAltitude(-123.5), -124);
  assert.equal(roundAltitude(undefined), undefined);
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  assert.equal(getDefaultCollector(storage), DEFAULT_COLLECTOR);
  assert.equal(getUseCurrentLocation(storage), true);
  assert.equal(setUseCurrentLocation(false, storage), false);
  assert.equal(entries.get(USE_CURRENT_LOCATION_STORAGE_KEY), "false");
  assert.equal(getUseCurrentLocation(storage), false);
  assert.equal(setUseCurrentLocation(true, storage), true);
  assert.equal(getUseCurrentLocation(storage), true);
  assert.equal(
    setDefaultCollector("  A. Collector  ", storage),
    "A. Collector",
  );
  assert.equal(entries.get(COLLECTOR_STORAGE_KEY), "A. Collector");
  assert.equal(getDefaultCollector(storage), "A. Collector");
  assert.equal(getDefaultIdentifier(storage), "A. Collector");
  assert.equal(
    setDefaultIdentifier("  B. Identifier  ", storage),
    "B. Identifier",
  );
  assert.equal(entries.get(IDENTIFIER_STORAGE_KEY), "B. Identifier");
  assert.equal(getDefaultIdentifier(storage), "B. Identifier");
  assert.throws(() => setDefaultIdentifier("   ", storage));
  assert.throws(() => setDefaultCollector("   ", storage));
});
test("continuous registration carries only last successfully saved names; opt-out and unidentified reset names", () => {
  const date = new Date(2026, 9, 10);
  const storage = { getItem: () => "B. Identifier" };
  const defaults = initialIdentification(date, storage);
  assert.equal(localDate(date), "2026-10-10");
  assert.deepEqual(defaults, {
    ...emptyIdentification,
    identifiedAt: "2026-10-10",
    identifiedBy: "B. Identifier",
  });
  const saved = {
    japaneseName: "アオスジアゲハ",
    scientificName: "Graphium sarpedon",
    identifiedAt: "2026-09-29",
    identifiedBy: "A",
    memo: "first specimen only",
  };
  const next = nextIdentification(saved, true, date, storage);
  assert.deepEqual(next, {
    ...defaults,
    japaneseName: saved.japaneseName,
    scientificName: saved.scientificName,
  });
  assert.deepEqual(nextIdentification(saved, false, date, storage), defaults);
  assert.deepEqual(nextIdentification(null, true, date, storage), defaults);
  assert.deepEqual(
    nextIdentification(emptyIdentification, true, date, storage),
    defaults,
  );
  next.japaneseName = "別の種";
  assert.equal(saved.japaneseName, "アオスジアゲハ");
});
