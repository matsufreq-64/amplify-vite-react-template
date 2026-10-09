import type { Taxon } from "./domain";
import { parseCsv } from "./csv";

const columns = [
  ["scientificName", "学名"],
  ["japaneseName", "和名"],
  ["orderJapaneseName", "目（和名）"],
  ["orderScientificName", "目（学名）"],
  ["familyJapaneseName", "科（和名）"],
  ["familyScientificName", "科（学名）"],
  ["subfamilyJapaneseName", "亜科（和名）"],
  ["subfamilyScientificName", "亜科（学名）"],
  ["genusScientificName", "属（学名）"],
  ["descriptionYear", "記載年"],
  ["sortOrder", "表示順"],
] as const;
export const taxonCsvHeaders = columns.map(([, label]) => label);
export const taxonCsvExample = [
  taxonCsvHeaders,
  [
    "Graphium sarpedon",
    "アオスジアゲハ",
    "",
    "",
    "",
    "",
    "",
    "",
    "Graphium",
    "",
    "0",
  ],
];
export type TaxonImport = Omit<Taxon, "id">;
export function parseTaxonCsv(source: string): TaxonImport[] {
  const [head, ...rows] = parseCsv(source);
  if (!head) throw new Error("CSVが空です。");
  const indexes = columns.map(([key, label]) =>
    head.findIndex(
      (name) =>
        name.trim().replace(/^\uFEFF/, "") === key || name.trim() === label,
    ),
  );
  if (indexes[0] < 0) throw new Error("学名またはscientificName列が必要です。");
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const line = index + 2;
    const value = (position: number) =>
      indexes[position] < 0 ? "" : (row[indexes[position]] ?? "").trim();
    const scientificName = value(0);
    if (!scientificName) throw new Error(`${line}行目の学名が空です。`);
    const key = scientificName.normalize("NFKC").toLowerCase();
    if (seen.has(key))
      throw new Error(
        `${line}行目の学名がCSV内で重複しています：${scientificName}`,
      );
    seen.add(key);
    const year = value(9),
      order = value(10);
    if (
      year &&
      (!/^\d+$/.test(year) || Number(year) < 1 || Number(year) > 9999)
    )
      throw new Error(`${line}行目の記載年が不正です。`);
    if (order && !Number.isFinite(Number(order)))
      throw new Error(`${line}行目の表示順が不正です。`);
    return {
      scientificName,
      japaneseName: value(1),
      orderJapaneseName: value(2),
      orderScientificName: value(3),
      familyJapaneseName: value(4),
      familyScientificName: value(5),
      subfamilyJapaneseName: value(6),
      subfamilyScientificName: value(7),
      genusScientificName: value(8),
      descriptionYear: year ? Number(year) : undefined,
      sortOrder: order ? Number(order) : 0,
    };
  });
}
