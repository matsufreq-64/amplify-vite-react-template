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
test("county and town or village are separated before romanization", () => {
  for (const [city, city_kana, expected] of [
    ["木曽郡南木曽町", "きそぐんなぎそまち", "Kiso-gun, Nagiso-machi"],
    ["下伊那郡阿南町", "しもいなぐんあなんちょう", "Shimoina-gun, Anan-chō"],
    ["木曽郡大桑村", "きそぐんおおくわむら", "Kiso-gun, Ōkuwa-mura"],
    ["大島郡宇検村", "おおしまぐんうけんそん", "Ōshima-gun, Uken-son"],
    ["木曽郡木祖村", "キソグンキソムラ", "Kiso-gun, Kiso-mura"],
    ["上伊那郡箕輪町", "かみいなぐんみのわまち", "Kamiina-gun, Minowa-machi"],
    ["南木曽町", "なぎそまち", "Nagiso-machi"],
    ["郡山市", "こおりやまし", "Kōriyama-shi"],
  ]) {
    assert.equal(
      localityLabels({ ...place, city, city_kana }).localityRomaji_2,
      expected,
    );
  }
});
test("map address fills three capitalized label lines", () => {
  assert.deepEqual(localityLabels(place), {
    localityRomaji_1: "Japan: Aichi-ken,",
    localityRomaji_2: "Nagoya-shi, Atsuta-ku",
    localityRomaji_3: "Tammachō",
  });
});
test("municipality boundaries do not split syllables within names", () => {
  assert.equal(
    localityLabels({
      ...place,
      city: "静岡市清水区",
      city_kana: "しずおかししみずく",
    }).localityRomaji_2,
    "Shizuoka-shi, Shimizu-ku",
  );
  assert.equal(
    localityLabels({
      ...place,
      prefecture: "東京都",
      city: "府中市",
      city_kana: "ふちゅうし",
    }).localityRomaji_1,
    "Japan: Tōkyō-to,",
  );
  assert.equal(
    localityLabels({ ...place, prefecture: "北海道" }).localityRomaji_1,
    "Japan: Hokkaidō,",
  );
  assert.equal(
    localityLabels({ ...place, city: "市川市", city_kana: "いちかわし" })
      .localityRomaji_2,
    "Ichikawa-shi",
  );
});

test("macrons and municipality suffixes match requested spellings", () => {
  for (const [city, city_kana, expected] of [
    ["京都市", "きょうとし", "Kyōto-shi"],
    ["大阪市", "おおさかし", "Ōsaka-shi"],
    ["阿南町", "あなんちょう", "Anan-chō"],
    ["府中市", "ふちゅうし", "Fuchū-shi"],
    ["新潟市", "にいがたし", "Niigata-shi"],
  ])
    assert.equal(
      localityLabels({ ...place, city, city_kana }).localityRomaji_2,
      expected,
    );
  assert.equal(
    localityLabels({ ...place, prefecture: "京都府" }).localityRomaji_1,
    "Japan: Kyōto-fu,",
  );
  assert.equal(
    localityLabels({ ...place, prefecture: "大阪府" }).localityRomaji_1,
    "Japan: Ōsaka-fu,",
  );
});
