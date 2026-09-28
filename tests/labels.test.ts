import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildLabelWorkbook, defaultLayout } from "../src/printing/labels";
const batch = {
  id: "batch",
  collectingEventId: "event-id",
  eventNumber: 2,
  firstNumber: 103,
  count: 4,
  createdAt: "2026-09-29T00:00:00.000Z",
  snapshot: {
    id: "event-id",
    eventNumber: 2,
    localityJapaneseFull: "愛知県名古屋市",
    localityJapaneseShort: "名古屋市",
    localityRomaji: "Nagoya",
    date: "2026-09-29",
    collector: "Collector",
    method: "灯火",
    memo: "",
  },
};
test("Excel contains one anchored QR per label and preserves allocated numbers on repeated generation", async () => {
  const book = await buildLabelWorkbook(batch, defaultLayout);
  const bytes = await book.xlsx.writeBuffer();
  const reload = new ExcelJS.Workbook();
  await reload.xlsx.load(bytes);
  const sheet = reload.worksheets[0];
  assert.match(String(sheet.getCell("A1").value), /SP 00000103/);
  assert.match(String(sheet.getCell("A7").value), /SP 00000106/);
  assert.equal(sheet.getImages().length, 4);
  assert.equal(sheet.pageSetup.scale, 100);
  const second = await buildLabelWorkbook(batch, defaultLayout);
  assert.equal(
    second.worksheets[0].getCell("A1").value,
    sheet.getCell("A1").value,
  );
});
test("uploaded template formatting and cells outside the placement area survive", async () => {
  const template = new ExcelJS.Workbook();
  const sheet = template.addWorksheet("用紙");
  sheet.getCell("Z30").value = "保持する内容";
  sheet.getCell("A1").font = { size: 7 };
  const bytes = await template.xlsx.writeBuffer();
  const book = await buildLabelWorkbook(
    { ...batch, count: 1 },
    defaultLayout,
    bytes as unknown as ArrayBuffer,
  );
  assert.equal(book.worksheets[0].getCell("Z30").value, "保持する内容");
  assert.equal(book.worksheets[0].getCell("A1").font.size, 7);
});
