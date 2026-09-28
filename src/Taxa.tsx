import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { listPage, saveTaxon } from "./api/workflow";
import type { Taxon } from "./domain";
import { Field, Notice } from "./ui";
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
  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    void listPage<Taxon>("Taxon")
      .then((p) => {
        if (active) {
          setItems(p.items);
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
