import { test } from "node:test";
import assert from "node:assert/strict";
import { localityLabels } from "../src/localityLabels";
const place = {
  prefecture: "愛知県",
  city: "名古屋市熱田区",
  city_kana: "なごやしあつたく",
  town: "伝馬町",
  town_kana: "たんまちょう",
};
test("map address fills three capitalized label lines", () => {
  assert.deepEqual(localityLabels(place), {
    localityRomaji_1: "Japan: Aichi-ken,",
    localityRomaji_2: "Nagoyashi, Atsutaku",
    localityRomaji_3: "Tammacho",
  });
});
test("municipality boundaries do not split syllables within names", () => {
  assert.equal(
    localityLabels({
      ...place,
      city: "静岡市清水区",
      city_kana: "しずおかししみずく",
    }).localityRomaji_2,
    "Shizuokashi, Shimizuku",
  );
  assert.equal(
    localityLabels({
      ...place,
      prefecture: "東京都",
      city: "府中市",
      city_kana: "ふちゅうし",
    }).localityRomaji_1,
    "Japan: Tokyo-to,",
  );
  assert.equal(
    localityLabels({ ...place, prefecture: "北海道" }).localityRomaji_1,
    "Japan: Hokkaido,",
  );
  assert.equal(
    localityLabels({ ...place, city: "市川市", city_kana: "いちかわし" })
      .localityRomaji_2,
    "Ichikawashi",
  );
});
