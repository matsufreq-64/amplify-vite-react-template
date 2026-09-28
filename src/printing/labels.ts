import type { LabelBatch } from "../domain";
import { makeQr } from "../domain";
export type Layout = {
  startRow: number;
  startColumn: number;
  rowStride: number;
  columnStride: number;
  labelsPerRow: number;
  qrSizeMm: number;
};
export const defaultLayout: Layout = {
  startRow: 1,
  startColumn: 1,
  rowStride: 6,
  columnStride: 4,
  labelsPerRow: 3,
  qrSizeMm: 10,
};
export async function buildLabelWorkbook(
  batch: LabelBatch,
  layout: Layout,
  template?: ArrayBuffer,
) {
  const [{ default: ExcelJS }, { default: QRCode }] = await Promise.all([
    import("exceljs"),
    import("qrcode"),
  ]);
  for (const [key, value] of Object.entries(layout))
    if (
      !Number.isFinite(value) ||
      value < 1 ||
      (key !== "qrSizeMm" && !Number.isInteger(value))
    )
      throw new Error("配置設定には正の数（セル数は整数）を指定してください。");
  if (
    layout.columnStride < 2 ||
    layout.labelsPerRow > 10 ||
    layout.qrSizeMm > 40
  )
    throw new Error(
      "ラベルの列間隔は2以上、横枚数は10以下、QRは40mm以下にしてください。",
    );
  const workbook = new ExcelJS.Workbook();
  if (template) await workbook.xlsx.load(template);
  const sheet = workbook.worksheets[0] ?? workbook.addWorksheet("データラベル");
  if (!template) {
    sheet.pageSetup = {
      paperSize: 9,
      orientation: "portrait",
      scale: 100,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.25,
        bottom: 0.25,
        header: 0,
        footer: 0,
      },
    };
    for (let c = 1; c <= layout.labelsPerRow * layout.columnStride; c++)
      sheet.getColumn(c).width = 6;
  }
  const ev = batch.snapshot;
  for (let i = 0; i < batch.count; i++) {
    const row =
      layout.startRow + Math.floor(i / layout.labelsPerRow) * layout.rowStride;
    const col =
      layout.startColumn + (i % layout.labelsPerRow) * layout.columnStride;
    const n = batch.firstNumber + i;
    if (!template) {
      for (let r = row; r < row + layout.rowStride; r++)
        sheet.getRow(r).height = 9;
      sheet.mergeCells(
        row,
        col,
        row + layout.rowStride - 1,
        col + layout.columnStride - 2,
      );
    }
    const cell = sheet.getCell(row, col);
    cell.value = [
      ev.localityJapaneseShort || ev.localityJapaneseFull,
      ev.localityRomaji,
      `${ev.date}  ${ev.collector} leg.`,
      ev.altitude != null ? `${ev.altitude} m` : "",
      `CE ${ev.eventNumber} / SP ${String(n).padStart(8, "0")}`,
    ]
      .filter(Boolean)
      .join("\n");
    if (!template) {
      cell.font = { name: "Arial", size: 6 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFBBBBBB" } } };
    }
    const image = await QRCode.toDataURL(
      [{ data: makeQr(batch.eventNumber, n), mode: "numeric" }],
      { errorCorrectionLevel: "M", margin: 4, width: 300 },
    );
    const imageId = workbook.addImage({ base64: image, extension: "png" });
    const px = (layout.qrSizeMm * 96) / 25.4;
    sheet.addImage(imageId, {
      tl: { col: col + layout.columnStride - 2, row: row - 1 },
      ext: { width: px, height: px },
      editAs: "oneCell",
    });
  }
  if (!template)
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(layout.labelsPerRow * layout.columnStride).letter}${layout.startRow + Math.ceil(batch.count / layout.labelsPerRow) * layout.rowStride - 1}`;
  return workbook;
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadLabels(
  batch: LabelBatch,
  layout: Layout,
  template?: File,
) {
  const workbook = await buildLabelWorkbook(
    batch,
    layout,
    template ? await template.arrayBuffer() : undefined,
  );
  const bytes = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `labels-CE${batch.eventNumber}-SP${batch.firstNumber}-${batch.firstNumber + batch.count - 1}.xlsx`,
  );
}
