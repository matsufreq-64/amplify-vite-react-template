import { test } from "node:test";
import assert from "node:assert/strict";
import { applyMapDetails, beginMapSelection } from "../src/mapSelection";
import type { EventInput } from "../src/domain";

const previous: EventInput = {
  localityJapaneseFull: "愛知県名古屋市熱田区",
  localityJapaneseShort: "名古屋市熱田区",
  localityRomaji: "Nagoya",
  localityRomaji_1: "Japan: Aichi-ken,",
  localityRomaji_2: "Nagoya-shi, Atsuta-ku",
  localityRomaji_3: "Tammacho",
  latitude: 35.0781,
  longitude: 136.8495,
  altitude: 12,
  date: "2026-10-11",
  collector: "S. Matsubara",
  method: "灯火",
  memo: "test",
};

test("selecting a new point clears locality and altitude from the previous point", () => {
  const selected = beginMapSelection(previous, 34.5, 135.5);
  assert.equal(selected.latitude, 34.5);
  assert.equal(selected.longitude, 135.5);
  assert.equal(selected.altitude, undefined);
  assert.equal(selected.localityJapaneseFull, "");
  assert.equal(selected.localityRomaji_1, "");
  assert.equal(selected.localityRomaji_2, "");
  assert.equal(selected.collector, previous.collector);
  assert.equal(selected.method, previous.method);
});

test("partial lookup failure cannot restore an old locality or altitude", () => {
  const selected = beginMapSelection(previous, 34.5, 135.5);
  const result = applyMapDetails(selected, {
    altitude: { status: "fulfilled", value: 42.7 },
    place: { status: "rejected", reason: new Error("地名なし") },
  });
  assert.equal(result.altitude, 43);
  assert.equal(result.localityJapaneseFull, "");
  assert.equal(result.localityRomaji_1, "");
});
