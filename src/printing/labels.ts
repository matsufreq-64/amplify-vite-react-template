import type { CollectingEvent, LabelBatch } from "../domain";
import { makeQr, numberValue } from "../domain";
import type JSZip from "jszip";
import { labelDate } from "./date";
import { microQrPng } from "./microQr";

export const LABEL_TEMPLATE_FILE = "labels-template_v4.xlsm";
export const LABELS_PER_PAGE = 36;
const NS = "http://schemas.openxmlformats.org/";
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
async function required(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file)
    throw new Error(`テンプレートに必要なファイルがありません：${path}`);
  return file.async("string");
}
async function inspectTemplate(bytes: ArrayBuffer | Uint8Array) {
  const { default: Zip } = await import("jszip");
  const zip = await Zip.loadAsync(bytes);
  const sheet = await required(zip, "xl/worksheets/sheet1.xml");
  const sharedXml = await required(zip, "xl/sharedStrings.xml");
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((t) => decodeXml(t[1]))
      .join(""),
  );
  for (const key of [
    "localityRomaji_1",
    "localityRomaji_2",
    "localityRomaji_3",
    "localityJapaneseShort",
    "latitude",
    "longitude",
    "altitude",
    "date",
    "collector",
    "method",
    "CE",
    "SP",
  ]) {
    if (!shared.some((s) => s.includes(`$${key}$`)))
      throw new Error(`テンプレートの項目が見つかりません：${key}`);
  }
  const templateRows = [
    ...sheet.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g),
  ]
    .map((match) => ({ number: Number(match[1]), xml: match[0] }))
    .filter((row) => row.number <= 77);
  if (templateRows.filter((row) => row.number <= 72).length !== 72)
    throw new Error("テンプレートのラベル12段×6行を読み取れませんでした。");
  if (!sheet.includes('ref="A1:F76"'))
    throw new Error("指定テンプレートの6列レイアウトを確認できませんでした。");
  return { zip, sheet, shared, templateRows };
}
export async function loadLabelTemplate(): Promise<Uint8Array> {
  const result = await fetch(
    `${import.meta.env?.BASE_URL ?? "/"}templates/${LABEL_TEMPLATE_FILE}`,
  );
  if (!result.ok)
    throw new Error(
      "ラベルテンプレートを取得できませんでした。再試行してください。",
    );
  const bytes = new Uint8Array(await result.arrayBuffer());
  await inspectTemplate(bytes); // Validate before allocating numbers.
  return bytes;
}
function valuesFor(
  event: CollectingEvent,
  specimenNumber: number,
): Record<string, string> {
  return {
    localityRomaji_1: event.localityRomaji_1 ?? "",
    localityRomaji_2: event.localityRomaji_2 ?? "",
    localityRomaji_3: event.localityRomaji_3 ?? "",
    localityJapaneseShort:
      event.localityJapaneseShort || event.localityJapaneseFull,
    latitude: event.latitude == null ? "" : Math.abs(event.latitude).toFixed(4),
    longitude:
      event.longitude == null ? "" : Math.abs(event.longitude).toFixed(4),
    altitude: event.altitude == null ? "" : String(event.altitude),
    date: labelDate(event.date),
    collector: event.collector,
    method: event.method,
    CE: String(event.eventNumber),
    SP: String(specimenNumber),
  };
}
function fillText(
  source: string,
  event: CollectingEvent,
  specimenNumber: number,
) {
  const values = valuesFor(event, specimenNumber);
  let value = source.replace(/\$([\w]+)\$/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`未対応のテンプレート項目：${key}`);
    return values[key];
  });
  // The provided template uses N/E. Correct hemispheres and omit absent measurements.
  if (source.includes("$latitude$")) {
    value = [
      event.latitude == null
        ? ""
        : `${values.latitude}°${event.latitude < 0 ? "S" : "N"}`,
      event.longitude == null
        ? ""
        : `${values.longitude}°${event.longitude < 0 ? "W" : "E"}`,
      event.altitude == null ? "" : `alt.${values.altitude}m`,
    ]
      .filter(Boolean)
      .join(", ");
  }
  if (source.includes("$localityRomaji_1$") && !values.localityRomaji_1)
    value = "";
  else if (
    source.includes("$localityRomaji_1$") &&
    /^Japan\s*:/i.test(values.localityRomaji_1.trim())
  )
    value = values.localityRomaji_1.trim();
  if (source.includes("$localityRomaji_2$") && !values.localityRomaji_2)
    value = "";
  return value;
}
/** Patch OOXML directly so ExcelJS does not discard template VBA, styles or printer settings. */
export async function buildTemplateLabels(
  batch: LabelBatch,
  template: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (!Number.isInteger(batch.count) || batch.count < 1 || batch.count > 80)
    throw new Error("ラベル枚数は1〜80枚で指定してください。");
  numberValue(batch.eventNumber);
  numberValue(batch.firstNumber);
  numberValue(batch.firstNumber + batch.count - 1);
  const { zip, sheet, shared, templateRows } = await inspectTemplate(template);
  const pages = Math.ceil(batch.count / LABELS_PER_PAGE);
  const totalRows = pages * 77;
  const rows: string[] = [];
  for (let page = 0; page < pages; page++) {
    for (const templateRow of templateRows) {
      const rowNumber = page * 77 + templateRow.number;
      let row = templateRow.xml.replace(
        /(<row\b[^>]*\br=")[^"]+"/,
        `$1${rowNumber}"`,
      );
      row = row.replace(
        /<c\b([^>]*?\br="([A-Z]+)\d+"[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
        (_cell, attrs: string, column: string, body: string | undefined) => {
          if (!["A", "B", "C", "D", "E", "F"].includes(column)) return "";
          const cellAttrs = attrs
            .replace(/\br="[^"]+"/, `r="${column}${rowNumber}"`)
            .replace(/\s+t="[^"]*"/, "");
          const match = body?.match(/<v>(\d+)<\/v>/);
          if (!/\bt="s"/.test(attrs) || !match)
            return `<c${cellAttrs}>${body ?? ""}</c>`;
          const labelColumn =
            column === "A" || column === "B"
              ? 0
              : column === "C" || column === "D"
                ? 1
                : 2;
          const index =
            page * LABELS_PER_PAGE +
            Math.floor((templateRow.number - 1) / 6) * 3 +
            labelColumn;
          const value =
            templateRow.number <= 72 && index < batch.count
              ? fillText(
                  shared[Number(match[1])],
                  batch.snapshot,
                  batch.firstNumber + index,
                )
              : "";
          return `<c${cellAttrs} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        },
      );
      rows.push(row);
    }
  }
  let outputSheet = sheet
    .replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      `<sheetData>${rows.join("")}</sheetData>`,
    )
    .replace(/<dimension\b[^>]*\/>/, `<dimension ref="A1:F${totalRows}"/>`)
    .replace(/<controls\b[\s\S]*?<\/controls>/g, "")
    .replace(/<legacyDrawing\b[^>]*\/>/g, "")
    .replace(/<drawing\b[^>]*\/>/g, "")
    .replace(/<rowBreaks\b[\s\S]*?<\/rowBreaks>/g, "");
  const breaks = Array.from(
    { length: pages - 1 },
    (_, i) => `<brk id="${(i + 1) * 77}" min="0" max="16383" man="1"/>`,
  );
  outputSheet = outputSheet.replace(
    "</worksheet>",
    `${breaks.length ? `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${breaks.join("")}</rowBreaks>` : ""}<drawing r:id="rIdLabelImages"/></worksheet>`,
  );
  zip.file("xl/worksheets/sheet1.xml", outputSheet);
  const rels = (await required(zip, "xl/worksheets/_rels/sheet1.xml.rels"))
    .replace(
      /<Relationship\b[^>]*Type="[^"]*\/(?:control|drawing|vmlDrawing|image)"[^>]*\/>/g,
      "",
    )
    .replace(
      "</Relationships>",
      `<Relationship Id="rIdLabelImages" Type="${NS}officeDocument/2006/relationships/drawing" Target="../drawings/labelImages.xml"/></Relationships>`,
    );
  zip.file("xl/worksheets/_rels/sheet1.xml.rels", rels);
  const anchors: string[] = [];
  const imageRels: string[] = [];
  for (let i = 0; i < batch.count; i++) {
    const qr = makeQr(batch.eventNumber, batch.firstNumber + i);
    zip.file(`xl/media/labelQr${i + 1}.png`, await microQrPng(qr));
    imageRels.push(
      `<Relationship Id="rId${i + 1}" Type="${NS}officeDocument/2006/relationships/image" Target="../media/labelQr${i + 1}.png"/>`,
    );
    // 8.5mm fits B/D/F above the number printed on each label's sixth row.
    anchors.push(
      `<xdr:oneCellAnchor><xdr:from><xdr:col>${1 + (i % 3) * 2}</xdr:col><xdr:colOff>9000</xdr:colOff><xdr:row>${Math.floor(i / LABELS_PER_PAGE) * 77 + Math.floor((i % LABELS_PER_PAGE) / 3) * 6}</xdr:row><xdr:rowOff>9000</xdr:rowOff></xdr:from><xdr:ext cx="306000" cy="306000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 1}" name="Specimen ${batch.firstNumber + i}" descr="${qr}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="306000" cy="306000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`,
    );
  }
  zip.file(
    "xl/drawings/labelImages.xml",
    `${XML_HEADER}<xdr:wsDr xmlns:xdr="${NS}drawingml/2006/spreadsheetDrawing" xmlns:a="${NS}drawingml/2006/main" xmlns:r="${NS}officeDocument/2006/relationships">${anchors.join("")}</xdr:wsDr>`,
  );
  zip.file(
    "xl/drawings/_rels/labelImages.xml.rels",
    `${XML_HEADER}<Relationships xmlns="${NS}package/2006/relationships">${imageRels.join("")}</Relationships>`,
  );
  let types = await required(zip, "[Content_Types].xml");
  if (!types.includes('Extension="png"'))
    types = types.replace(
      "</Types>",
      '<Default Extension="png" ContentType="image/png"/></Types>',
    );
  zip.file(
    "[Content_Types].xml",
    types.replace(
      "</Types>",
      `<Override PartName="/xl/drawings/labelImages.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    ),
  );
  let workbook = await required(zip, "xl/workbook.xml");
  workbook = workbook.replace(
    /<definedName\b[^>]*name="_xlnm.Print_Area"[^>]*>[\s\S]*?<\/definedName>/g,
    "",
  );
  const area = `<definedName name="_xlnm.Print_Area" localSheetId="0">'label_templete'!$A$1:$F$${totalRows}</definedName>`;
  workbook = workbook.includes("</definedNames>")
    ? workbook.replace("</definedNames>", `${area}</definedNames>`)
    : workbook.replace(
        "</sheets>",
        `</sheets><definedNames>${area}</definedNames>`,
      );
  zip.file("xl/workbook.xml", workbook);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadLabels(batch: LabelBatch, template?: Uint8Array) {
  const bytes = await buildTemplateLabels(
    batch,
    template ?? (await loadLabelTemplate()),
  );
  downloadBlob(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.ms-excel.sheet.macroEnabled.12",
    }),
    `labels-CE${batch.eventNumber}-SP${batch.firstNumber}-${batch.firstNumber + batch.count - 1}.xlsm`,
  );
}
