import { toHiragana, toRomaji } from "wanakana";
import type { HeartRailsLocation } from "./types";

const prefectures = Object.fromEntries([
  ["北海道", "Hokkaidō"],
  ["青森", "Aomori"],
  ["岩手", "Iwate"],
  ["宮城", "Miyagi"],
  ["秋田", "Akita"],
  ["山形", "Yamagata"],
  ["福島", "Fukushima"],
  ["茨城", "Ibaraki"],
  ["栃木", "Tochigi"],
  ["群馬", "Gunma"],
  ["埼玉", "Saitama"],
  ["千葉", "Chiba"],
  ["東京", "Tōkyō"],
  ["神奈川", "Kanagawa"],
  ["新潟", "Niigata"],
  ["富山", "Toyama"],
  ["石川", "Ishikawa"],
  ["福井", "Fukui"],
  ["山梨", "Yamanashi"],
  ["長野", "Nagano"],
  ["岐阜", "Gifu"],
  ["静岡", "Shizuoka"],
  ["愛知", "Aichi"],
  ["三重", "Mie"],
  ["滋賀", "Shiga"],
  ["京都", "Kyōto"],
  ["大阪", "Ōsaka"],
  ["兵庫", "Hyōgo"],
  ["奈良", "Nara"],
  ["和歌山", "Wakayama"],
  ["鳥取", "Tottori"],
  ["島根", "Shimane"],
  ["岡山", "Okayama"],
  ["広島", "Hiroshima"],
  ["山口", "Yamaguchi"],
  ["徳島", "Tokushima"],
  ["香川", "Kagawa"],
  ["愛媛", "Ehime"],
  ["高知", "Kōchi"],
  ["福岡", "Fukuoka"],
  ["佐賀", "Saga"],
  ["長崎", "Nagasaki"],
  ["熊本", "Kumamoto"],
  ["大分", "Ōita"],
  ["宮崎", "Miyazaki"],
  ["鹿児島", "Kagoshima"],
  ["沖縄", "Okinawa"],
]);
// Explicit city readings avoid splitting a "shi" inside names such as Shizuoka.
const cities: Record<string, string> = {
  札幌市: "さっぽろし",
  仙台市: "せんだいし",
  さいたま市: "さいたまし",
  千葉市: "ちばし",
  横浜市: "よこはまし",
  川崎市: "かわさきし",
  相模原市: "さがみはらし",
  新潟市: "にいがたし",
  静岡市: "しずおかし",
  浜松市: "はままつし",
  名古屋市: "なごやし",
  京都市: "きょうとし",
  大阪市: "おおさかし",
  堺市: "さかいし",
  神戸市: "こうべし",
  岡山市: "おかやまし",
  広島市: "ひろしまし",
  北九州市: "きたきゅうしゅうし",
  福岡市: "ふくおかし",
  熊本市: "くまもとし",
};
function roman(value: string) {
  return toRomaji(value)
    .trim()
    .toLowerCase()
    .replace(/n(?=[bmp])/g, "m")
    .replace(/ou|oo/g, "ō")
    .replace(/uu/g, "ū")
    .replace(
      /(^|[\s,-])([a-zōū])/g,
      (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
    );
}
export function localityLabels(
  place: Pick<
    HeartRailsLocation,
    "prefecture" | "city" | "city_kana" | "town" | "town_kana"
  >,
) {
  const suffix = place.prefecture.slice(-1);
  const base =
    prefectures[
      place.prefecture === "北海道"
        ? place.prefecture
        : place.prefecture.slice(0, -1)
    ];
  const prefecture = base
    ? base +
      (suffix === "県"
        ? "-ken"
        : suffix === "都"
          ? "-to"
          : suffix === "府"
            ? "-fu"
            : "")
    : place.prefecture;
  const kana = toHiragana(place.city_kana ?? "").trim();
  // Split before romanization so gun + machi does not become gummachi.
  // Require a county in the Japanese address; 郡山市 is a city, not a county.
  const county = /^.+郡.+[町村]$/.test(place.city)
    ? /^(.+?ぐん)(.+)$/.exec(kana)
    : null;
  const city = Object.entries(cities).find(
    ([name, reading]) =>
      place.city.startsWith(name) && kana.startsWith(reading),
  );
  const municipality = county
    ? `${roman(county[1].slice(0, -2))}-gun, ${municipalityName(county[2], place.city)}`
    : city && place.city !== city[0]
      ? `${municipalityName(city[1], city[0])}, ${municipalityName(kana.slice(city[1].length), place.city.slice(city[0].length))}`
      : municipalityName(kana, place.city) || place.city;
  return {
    localityRomaji_1: prefecture ? `Japan: ${prefecture},` : "Japan:",
    localityRomaji_2: municipality,
    localityRomaji_3: roman(place.town_kana ?? "") || place.town,
  };
}

function municipalityName(kana: string, name: string) {
  const endings = name.endsWith("町")
    ? [
        ["まち", "machi"],
        ["ちょう", "chō"],
      ]
    : name.endsWith("村")
      ? [
          ["むら", "mura"],
          ["そん", "son"],
        ]
      : name.endsWith("市")
        ? [["し", "shi"]]
        : name.endsWith("区")
          ? [["く", "ku"]]
          : [];
  for (const [reading, suffix] of endings) {
    if (kana.endsWith(reading) && kana.length > reading.length)
      return `${roman(kana.slice(0, -reading.length))}-${suffix}`;
  }
  return roman(kana);
}
