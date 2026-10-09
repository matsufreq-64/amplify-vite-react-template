import { downloadBlob } from "./printing/labels";

export function csvText(rows: unknown[][]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    // Prevent spreadsheet programs from evaluating imported text as a formula.
    const safe =
      typeof value === "number" && Number.isFinite(value)
        ? text
        : /^[=+@\-\t\r]/.test(text)
          ? "'" + text
          : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
export function downloadCsv(rows: unknown[][], filename: string) {
  downloadBlob(
    new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

export function parseCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else cell += char;
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (char === "," || char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (char !== ",") {
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
      }
    } else if (closed || char === '"')
      throw new Error(`CSVの${rows.length + 1}行目の引用符が不正です。`);
    else cell += char;
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
