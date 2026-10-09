import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { buildTemplateLabels } from "../src/printing/labels";
import type { LabelBatch } from "../src/domain";
import { labelDate } from "../src/printing/date";
const template = await readFile(
  new URL("../public/templates/qr_label_template_v1.xlsm", import.meta.url),
);
const batch: LabelBatch = {
  id: "batch",
  collectingEventId: "event-id",
  eventNumber: 2,
  firstNumber: 103,
  count: 4,
  createdAt: "2026-09-29T00:00:00Z",
  snapshot: {
    id: "event-id",
    eventNumber: 2,
    localityJapaneseFull: "愛知県名古屋市",
    localityJapaneseShort: "名古屋市",
    localityRomaji: "Original",
    localityRomaji_1: "Aichi Pref.",
    localityRomaji_2: "Nagoya-shi",
    localityRomaji_3: "Atsuta-ku",
    latitude: 35.123456,
    longitude: 136.987654,
    altitude: 10,
    date: "2026-09-29",
    collector: "S. Matsubara",
    method: "灯火",
    memo: "",
  },
};
async function sheetValues(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  return workbook.worksheets[0];
}
test("country prefix and comma are not duplicated for new map labels", async () => {
  const sheet = await sheetValues(
    await buildTemplateLabels(
      {
        ...batch,
        snapshot: { ...batch.snapshot, localityRomaji_1: "Japan: Aichi-ken," },
      },
      template,
    ),
  );
  assert.equal(sheet.getCell("A1").value, "Japan: Aichi-ken,");
});
test("provided template fills all placeholders, anchors a distinct QR per specimen, and keeps original styles and VBA", async () => {
  const bytes = await buildTemplateLabels(batch, template);
  const zip = await JSZip.loadAsync(bytes);
  const original = await JSZip.loadAsync(template);
  const sheet = await sheetValues(bytes);
  assert.equal(sheet.getCell("A1").value, "Japan: Aichi Pref.,");
  assert.equal(sheet.getCell("A2").value, "Nagoya-shi,");
  assert.equal(sheet.getCell("A3").value, "Atsuta-ku");
  assert.equal(sheet.getCell("A5").value, "35.1235°N, 136.9877°E, alt.10m");
  assert.equal(sheet.getCell("A6").value, "29-IX-2026,");
  assert.equal(sheet.getCell("A7").value, "S. Matsubara leg. 灯火");
  assert.equal(sheet.getCell("B7").value, "2/103");
  assert.equal(sheet.getCell("D7").value, "2/104");
  assert.equal(sheet.getCell("B14").value, "2/105");
  assert.equal(sheet.getCell("D14").value, "2/106");
  assert.equal(sheet.getRow(1).height, 5.4);
  assert.equal(sheet.getCell("A1").font.size, 4);
  assert.equal(sheet.getImages().length, 4);
  for (const file of [
    "xl/styles.xml",
    "xl/vbaProject.bin",
    "xl/printerSettings/printerSettings1.bin",
  ]) {
    assert.deepEqual(
      await zip.file(file)!.async("uint8array"),
      await original.file(file)!.async("uint8array"),
    );
  }
  const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.doesNotMatch(xml, /\$\w+\$/);
  assert.doesNotMatch(xml, /<controls\b/);
  const drawing = await zip
    .file("xl/drawings/labelImages.xml")!
    .async("string");
  for (let n = 103; n <= 106; n++)
    assert.ok(
      drawing.includes(`descr="00000002${String(n).padStart(8, "0")}"`),
    );
  assert.match(xml, /paperSize="43"/);
});

test("label dates use Roman months without changing stored dates", () => {
  const months = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ];
  for (let month = 1; month <= 12; month++)
    assert.equal(
      labelDate(`2026-${String(month).padStart(2, "0")}-05`),
      `05-${months[month - 1]}-2026`,
    );
  assert.equal(labelDate("2026-09-05"), "05-IX-2026");
  assert.equal(batch.snapshot.date, "2026-09-29");
  assert.equal(labelDate(""), "");
});
test("odd quantities clear unused slots and additional pages preserve sequential numbers", async () => {
  const bytes = await buildTemplateLabels({ ...batch, count: 21 }, template);
  const sheet = await sheetValues(bytes);
  assert.equal(sheet.getCell("B77").value, "2/123");
  assert.equal(sheet.getCell("C71").value ?? "", "");
  assert.equal(sheet.getCell("D77").value ?? "", "");
  assert.equal(sheet.getImages().length, 21);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(xml, /<brk id="70"/);
  const max = await buildTemplateLabels({ ...batch, count: 80 }, template);
  const maxSheet = await sheetValues(max);
  assert.equal(maxSheet.getCell("D280").value, "2/182");
  assert.equal(maxSheet.getImages().length, 80);
});
test("blank lines, XML characters, zero coordinates, south/west and retries are handled without changing template", async () => {
  const example = {
    ...batch,
    count: 1,
    snapshot: {
      ...batch.snapshot,
      localityRomaji_1: "A & B <C>",
      localityRomaji_2: "",
      localityRomaji_3: "Third",
      latitude: 0,
      longitude: -12.345678,
    },
  };
  const bytes = await buildTemplateLabels(example, template);
  const sheet = await sheetValues(bytes);
  assert.equal(sheet.getCell("A1").value, "Japan: A & B <C>,");
  assert.equal(sheet.getCell("A2").value ?? "", "");
  assert.equal(sheet.getCell("A3").value, "Third");
  assert.equal(sheet.getCell("A5").value, "0.0000°N, 12.3457°W, alt.10m");
  const second = await sheetValues(
    await buildTemplateLabels(example, template),
  );
  assert.equal(second.getCell("B7").value, sheet.getCell("B7").value);
  await assert.rejects(buildTemplateLabels({ ...batch, count: 0 }, template));
  await assert.rejects(buildTemplateLabels(batch, new Uint8Array([1, 2, 3])));
});
