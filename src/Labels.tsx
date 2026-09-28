import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { findEvent, listPage, reserveLabels } from "./api/workflow";
import { numberValue, type CollectingEvent, type LabelBatch } from "./domain";
import { EventSummary, Field, Notice } from "./ui";
import { defaultLayout, downloadLabels, type Layout } from "./printing/labels";
export default function Labels() {
  const [number, setNumber] = useState("");
  const [event, setEvent] = useState<CollectingEvent | null>(null);
  const [count, setCount] = useState(12);
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [template, setTemplate] = useState<File>();
  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    void listPage<LabelBatch>("LabelBatch")
      .then((p) => {
        if (active) {
          setBatches(p.items);
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
  async function run(task: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  function search(e: FormEvent) {
    e.preventDefault();
    setEvent(null);
    void run(async () => setEvent(await findEvent(numberValue(number))));
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">02 / DATA LABELS</span>
          <h1>データラベルを印刷</h1>
          <p>
            番号を確保してExcelを作成。実在標本の登録は、ラベルを付けたあとに。
          </p>
        </div>
      </div>
      <Notice error={error} message={message} />
      <div className="two-column">
        <div className="stack">
          <form className="panel stack" onSubmit={search}>
            <h2>採集イベントを選択</h2>
            <fieldset disabled={busy} className="inline-form">
              <Field label="採集イベント番号">
                <input
                  required
                  inputMode="numeric"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    setEvent(null);
                    setMessage("");
                  }}
                  placeholder="例：2"
                />
              </Field>
              <button className="secondary" type="submit">
                検索
              </button>
            </fieldset>
          </form>
          {event && (
            <>
              <EventSummary event={event} />
              <section className="panel stack">
                <Field
                  label="必要なラベル枚数（1〜80枚）"
                  hint="使わなかった番号は欠番になります。"
                >
                  <input
                    disabled={busy}
                    type="number"
                    min={1}
                    max={80}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  />
                </Field>
                <button
                  className="primary"
                  disabled={
                    busy || !Number.isInteger(count) || count < 1 || count > 80
                  }
                  onClick={() =>
                    void run(async () => {
                      const batch = await reserveLabels(
                        event.eventNumber,
                        count,
                      );
                      setBatches((v) => [
                        batch,
                        ...v.filter((b) => b.id !== batch.id),
                      ]);
                      setMessage(
                        `標本番号 ${batch.firstNumber}〜${batch.firstNumber + batch.count - 1} を確保しました。ダウンロードに失敗した場合は発行履歴から再作成できます。`,
                      );
                      await downloadLabels(batch, layout, template);
                    })
                  }
                >
                  {busy ? "処理しています…" : "番号を確保してExcelを作成"}
                </button>
                <small>この操作では標本レコードは作成されません。</small>
              </section>
            </>
          )}
        </div>
        <section className="panel stack">
          <h2>印刷レイアウト</h2>
          <p className="muted">
            標準はA4・横3枚。Excelの印刷倍率を100%にして試し刷りし、QRの読取と裁断位置を確認してください。
          </p>
          <Field
            label="独自のExcelテンプレート（任意）"
            hint="先頭シートに書き込みます。各ブロックの左上セルが本文、右端列がQRです。"
          >
            <input
              type="file"
              accept=".xlsx"
              disabled={busy}
              onChange={(e) => setTemplate(e.target.files?.[0])}
            />
          </Field>
          {template && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setTemplate(undefined)}
            >
              標準レイアウトを使用
            </button>
          )}
          <details>
            <summary>セル配置を調整</summary>
            <div className="form-grid">
              {(Object.keys(defaultLayout) as (keyof Layout)[]).map(
                (key, i) => (
                  <Field
                    key={key}
                    label={
                      [
                        "開始行",
                        "開始列（A=1）",
                        "縦の間隔（行数）",
                        "横の間隔（列数）",
                        "横に並べる枚数",
                        "QRサイズ / mm",
                      ][i]
                    }
                  >
                    <input
                      type="number"
                      min={1}
                      value={layout[key]}
                      disabled={busy}
                      onChange={(e) =>
                        setLayout((v) => ({
                          ...v,
                          [key]: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                ),
              )}
            </div>
          </details>
          <div className="label-preview">
            <div>
              <strong>採集地 / Locality</strong>
              <span>2026-09-29 Collector leg.</span>
              <small>CE 2 / SP 00000103</small>
            </div>
            <span className="qr-placeholder">QR</span>
          </div>
          <small>
            上図は構成の見本です。実際の内容は選択したイベントから作成します。
          </small>
        </section>
      </div>
      <section className="panel stack">
        <div className="section-heading">
          <h2>発行履歴・再印刷</h2>
          <span className="badge">同じ番号を再利用</span>
        </div>
        <p className="muted">
          同じ番号のラベルを、複数の標本に付けないでください。再印刷には発行時の採集情報を使います。
        </p>
        {!batches.length && (
          <div className="empty">読み込み済みの発行履歴はありません。</div>
        )}
        {[...batches]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((b) => (
            <div className="list-row" key={b.id}>
              <div>
                <strong>イベント #{b.eventNumber}</strong>
                <p>
                  SP {b.firstNumber}〜{b.firstNumber + b.count - 1} · {b.count}
                  枚
                </p>
                <small>{new Date(b.createdAt).toLocaleString("ja-JP")}</small>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(() => downloadLabels(b, layout, template))
                }
              >
                Excelを再作成
              </button>
            </div>
          ))}
        {cursor && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const p = await listPage<LabelBatch>("LabelBatch", cursor);
                setBatches((v) => [
                  ...v,
                  ...p.items.filter((b) => !v.some((old) => old.id === b.id)),
                ]);
                setCursor(p.cursor);
              })
            }
          >
            次の履歴を読み込む
          </button>
        )}
      </section>
    </div>
  );
}
