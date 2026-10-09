import { toRomaji } from "wanakana";
import type { HeartRailsLocation } from "./types";

const prefectures = Object.fromEntries([
  ["北海道", "Hokkaido"],
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
  ["東京", "Tokyo"],
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
  ["京都", "Kyoto"],
  ["大阪", "Osaka"],
  ["兵庫", "Hyogo"],
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
  ["高知", "Kochi"],
  ["福岡", "Fukuoka"],
  ["佐賀", "Saga"],
  ["長崎", "Nagasaki"],
  ["熊本", "Kumamoto"],
  ["大分", "Oita"],
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
    .replace(
      /(^|[\s,-])([a-z])/g,
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
  const kana = place.city_kana ?? "";
  const city = Object.entries(cities).find(
    ([name, reading]) =>
      place.city.startsWith(name) && kana.startsWith(reading),
  );
  const municipality =
    city && place.city !== city[0]
      ? `${roman(city[1])}, ${roman(kana.slice(city[1].length))}`
      : roman(kana) || place.city;
  return {
    localityRomaji_1: prefecture ? `Japan: ${prefecture},` : "Japan:",
    localityRomaji_2: municipality,
    localityRomaji_3: roman(place.town_kana ?? "").replace(/chou$/, "cho") || place.town,
  };
}
