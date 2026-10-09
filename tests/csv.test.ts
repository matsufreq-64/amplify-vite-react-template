import { test } from "node:test";
import assert from "node:assert/strict";
import { csvText, parseCsv } from "../src/csv";
import { parseTaxonCsv, taxonCsvExample } from "../src/taxonCsv";

test("CSV round trips Japanese, commas, quotes, line breaks, and BOM", () => {
  const rows = [
    ["採集地", "備考"],
    ["山梨県北杜市", '標本, "A"\n再確認'],
  ];
  assert.deepEqual(parseCsv(csvText(rows)), rows);
  assert.equal(parseCsv(csvText([["=SUM(1,1)"]]))[0][0], "'=SUM(1,1)");
});

test("name dictionary accepts example and English headings, validates every row", () => {
  assert.deepEqual(parseTaxonCsv(csvText(taxonCsvExample))[0], {
    scientificName: "Graphium sarpedon",
    japaneseName: "アオスジアゲハ",
    orderJapaneseName: "",
    orderScientificName: "",
    familyJapaneseName: "",
    familyScientificName: "",
    subfamilyJapaneseName: "",
    subfamilyScientificName: "",
    genusScientificName: "Graphium",
    descriptionYear: undefined,
    sortOrder: 0,
  });
  assert.deepEqual(
    parseTaxonCsv(
      "scientificName,japaneseName,descriptionYear,sortOrder\nPapilio xuthus,ナミアゲハ,1767,2",
    )[0],
    {
      scientificName: "Papilio xuthus",
      japaneseName: "ナミアゲハ",
      orderJapaneseName: "",
      orderScientificName: "",
      familyJapaneseName: "",
      familyScientificName: "",
      subfamilyJapaneseName: "",
      subfamilyScientificName: "",
      genusScientificName: "",
      descriptionYear: 1767,
      sortOrder: 2,
    },
  );
  assert.throws(() => parseTaxonCsv("和名\nテスト"));
  assert.throws(() => parseTaxonCsv("学名\nPapilio xuthus\npapilio xuthus"));
  assert.throws(() => parseTaxonCsv("学名,記載年\nPapilio xuthus,0"));
  assert.throws(() => parseCsv('学名\n"unclosed'));
});
