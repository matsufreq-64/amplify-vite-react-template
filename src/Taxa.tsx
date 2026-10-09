import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { listPage, saveTaxon } from "./api/workflow";
import type { Taxon } from "./domain";
import { Field, Notice } from "./ui";
import { downloadCsv } from "./csv";
import { parseTaxonCsv, taxonCsvExample, type TaxonImport } from "./taxonCsv";
const fields = [
  "japaneseName",
  "scientificName",
  "orderJapaneseName",
  "orderScientificName",
  "familyJapaneseName",
  "familyScientificName",
  "subfamilyJapaneseName",
  "subfamilyScientificName",
  "genusScientificName",
] as const;
const labels = [
  "和名",
  "学名 *",
  "目（和名）",
  "目（学名）",
  "科（和名）",
  "科（学名）",
  "亜科（和名）",
  "亜科（学名）",
  "属（学名）",
];
export default function Taxa() {
  const [items, setItems] = useState<Taxon[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Taxon>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [importRows, setImportRows] = useState<TaxonImport[]>([]);
  const [importName, setImportName] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    void listPage<Taxon>("Taxon")
      .then((p) => {
        if (active) {
          setItems((current) => [
            ...current,
            ...p.items.filter((taxon) => !current.some((item) => item.id === taxon.id)),
          ]);
          setCursor(p.cursor);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const row = await saveTaxon({
        ...form,
        scientificName: form.scientificName ?? "",
      });
      setItems((v) => [row, ...v.filter((t) => t.id !== row.id)]);
      setForm({});
      setMessage(
        "名前辞書を保存しました。過去の同定に保存した名前は変わりません。",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  async function chooseCsv(file: File | undefined) {
    setImportRows([]);
    setImportName("");
    setImportProgress("");
    setError("");
    setMessage("");
    if (!file) return;
    try {
      const rows = parseTaxonCsv(await file.text());
      if (!rows.length) throw new Error("取り込める辞書項目がありません。");
      setImportRows(rows);
      setImportName(file.name);
    } catch (cause) {
      setError(errorText(cause));
    }
  }
  async function importCsv() {
    if (guard.current || !importRows.length) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    let added = 0,
      skipped = 0;
    try {
      const known = new Set<string>();
      let next: string | null | undefined;
      do {
        const page = await listPage<Taxon>("Taxon", next);
        for (const taxon of page.items)
          known.add(taxon.scientificName.normalize("NFKC").toLowerCase());
        next = page.cursor;
      } while (next);
      for (const [index, input] of importRows.entries()) {
        const key = input.scientificName.normalize("NFKC").toLowerCase();
        if (known.has(key)) {
          skipped++;
          continue;
        }
        setImportProgress(`${index + 1} / ${importRows.length} 件を確認中`);
        const saved = await saveTaxon(input);
        known.add(key);
        added++;
        setItems((current) => [saved, ...current]);
      }
      setMessage(
        `${added}件を追加し、既存の学名${skipped}件をスキップしました。`,
      );
      setImportRows([]);
      setImportName("");
    } catch (cause) {
      setError(
        `${added}件追加したところで停止しました。${errorText(cause)} 再実行時は同じ学名をスキップします。`,
      );
    } finally {
      setImportProgress("");
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">REFERENCE / TAXON</span>
          <h1>名前辞書</h1>
          <p>和名から学名へ。名前は同定時の文字列として記録に残ります。</p>
        </div>
      </div>
      <Notice error={error} message={message} />
      <section className="panel stack">
        <div className="section-heading">
          <h2>CSVから名前辞書を追加</h2>
          <button
            className="secondary"
            type="button"
            onClick={() =>
              downloadCsv(taxonCsvExample, "name-dictionary-template.csv")
            }
          >
            見本CSVをダウンロード
          </button>
        </div>
        <p className="muted">
          UTF-8のCSVを選択してください。学名は必須です。同じ学名の既存項目はスキップし、過去の同定は変更しません。
        </p>
        <Field label="名前辞書CSVファイル">
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void chooseCsv(file);
            }}
          />
        </Field>
        {importRows.length > 0 && (
          <>
            <p>
              {importName}：{importRows.length}件を確認しました。
            </p>
            <small>
              {importRows
                .slice(0, 3)
                .map(
                  (row) =>
                    `${row.japaneseName || "和名なし"} / ${row.scientificName}`,
                )
                .join("、")}
              {importRows.length > 3 ? " ほか" : ""}
            </small>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void importCsv()}
            >
              {busy
                ? importProgress || "確認中…"
                : `${importRows.length}件をインポート`}
            </button>
          </>
        )}
      </section>
      <div className="two-column">
        <section className="panel stack">
          <h2>辞書を探す</h2>
          <Field label="読み込み済みの辞書を絞り込み">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="和名・学名・科名"
            />
          </Field>
          {items
            .filter((t) =>
              `${t.japaneseName} ${t.scientificName} ${t.familyJapaneseName}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((t) => (
              <button
                disabled={busy}
                className="taxon-row"
                key={t.id}
                onClick={() => {
                  setForm(t);
                  setMessage("");
                }}
              >
                <strong>{t.japaneseName || "和名なし"}</strong>
                <i>{t.scientificName}</i>
                <small>
                  {t.familyJapaneseName} / 表示順 {t.sortOrder ?? 0}
                </small>
              </button>
            ))}
          {!items.length && (
            <div className="empty">
              辞書はまだ読み込まれていません。種名を追加すると、同定時の入力候補になります。
            </div>
          )}
          {cursor && (
            <button
              disabled={busy}
              className="secondary"
              onClick={async () => {
                if (guard.current) return;
                guard.current = true;
                setBusy(true);
                try {
                  const p = await listPage<Taxon>("Taxon", cursor);
                  setItems((v) => [
                    ...v,
                    ...p.items.filter((t) => !v.some((old) => old.id === t.id)),
                  ]);
                  setCursor(p.cursor);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  guard.current = false;
                  setBusy(false);
                }
              }}
            >
              次のページを読み込む
            </button>
          )}
        </section>
        <form onSubmit={submit} className="panel stack">
          <fieldset disabled={busy} className="stack">
            <div className="section-heading">
              <h2>{form.id ? "辞書項目を編集" : "辞書項目を追加"}</h2>
              {form.id && (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setForm({})}
                >
                  新規追加へ
                </button>
              )}
            </div>
            <div className="form-grid">
              {fields.map((key, i) => (
                <Field key={key} label={labels[i]}>
                  <input
                    required={key === "scientificName"}
                    value={form[key] ?? ""}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, [key]: e.target.value }))
                    }
                  />
                </Field>
              ))}
              <Field label="記載年">
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={form.descriptionYear ?? ""}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      descriptionYear: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    }))
                  }
                />
              </Field>
              <Field label="表示順">
                <input
                  type="number"
                  step="any"
                  value={form.sortOrder ?? 0}
                  onChange={(e) =>
                    setForm((v) => ({
                      ...v,
                      sortOrder: Number(e.target.value),
                    }))
                  }
                />
              </Field>
            </div>
            <button className="primary" type="submit">
              {busy ? "保存しています…" : "辞書を保存"}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
