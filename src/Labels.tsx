import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { findEvent, listPage, reserveLabels } from "./api/workflow";
import { numberValue, type CollectingEvent, type LabelBatch } from "./domain";
import { EventSummary, Field, Notice } from "./ui";
import { downloadLabels, loadLabelTemplate } from "./printing/labels";
export default function Labels() {
  const [number, setNumber] = useState("");
  const [event, setEvent] = useState<CollectingEvent | null>(null);
  const [count, setCount] = useState(12);
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
                      const templateBytes = await loadLabelTemplate();
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
                      await downloadLabels(batch, templateBytes);
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
          <h2>指定のExcelテンプレート</h2>
          <p>
            <strong>qr_label_template.xlsm</strong>
          </p>
          <p className="muted">
            添付いただいたテンプレートの書式・行高・列幅・用紙設定を使います。横2枚×縦10段で、20枚を超える場合は次のページへ続きます。
          </p>
          <div className="label-preview">
            <div>
              <strong>Japan: {event?.localityRomaji_1 || "ラベル1行目"}</strong>
              <span>{event?.localityRomaji_2 || "ラベル2行目"}</span>
              <span>{event?.localityRomaji_3 || "ラベル3行目"}</span>
              <span>{event?.localityJapaneseShort || "採集地（日本語）"}</span>
              <small>
                {event?.date || "採集日"} / {event?.collector || "採集者"}
              </small>
            </div>
            <span className="qr-placeholder">QR</span>
          </div>
          <small>
            上図は項目の見本です。ローマ字の3行は各入力欄に対応し、未入力の行は空欄になります。緯度・経度は小数第4位まで印刷します。
          </small>
          <p className="muted">
            出力は .xlsm
            です。QRは画像として埋め込むため、印刷のためにマクロを実行する必要はありません。印刷倍率100%で試し刷りしてください。
          </p>
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
                onClick={() => void run(() => downloadLabels(b))}
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
