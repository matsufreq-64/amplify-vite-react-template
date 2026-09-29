import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLLECTOR,
  nextIdentification,
  roundCoordinate,
} from "../src/registrationDefaults";
import { emptyIdentification } from "../src/domain";
test("collector defaults and four-decimal coordinate boundaries", () => {
  assert.equal(DEFAULT_COLLECTOR, "S. Matsubara");
  assert.equal(roundCoordinate(35.1234567), 35.1235);
  assert.equal(roundCoordinate(-136.987654), -136.9877);
  assert.equal(roundCoordinate(0), 0);
  assert.equal(roundCoordinate(undefined), undefined);
});
test("continuous registration carries only last successfully saved names; opt-out and unidentified reset names", () => {
  const saved = {
    japaneseName: "アオスジアゲハ",
    scientificName: "Graphium sarpedon",
    identifiedAt: "2026-09-29",
    identifiedBy: "A",
    memo: "first specimen only",
  };
  const next = nextIdentification(saved, true);
  assert.deepEqual(next, {
    ...emptyIdentification,
    japaneseName: saved.japaneseName,
    scientificName: saved.scientificName,
  });
  assert.deepEqual(nextIdentification(saved, false), emptyIdentification);
  assert.deepEqual(nextIdentification(null, true), emptyIdentification);
  assert.deepEqual(
    nextIdentification(emptyIdentification, true),
    emptyIdentification,
  );
  next.japaneseName = "別の種";
  assert.equal(saved.japaneseName, "アオスジアゲハ");
});
