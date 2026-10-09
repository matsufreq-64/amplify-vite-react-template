import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { findEvent, listPage, reserveLabels } from "./api/workflow";
import { numberValue, type CollectingEvent, type LabelBatch } from "./domain";
import { EventSummary, Field, Notice } from "./ui";
import { downloadLabels, loadLabelTemplate } from "./printing/labels";
import { matchesEvent, searchEventPages } from "./eventSearch";
export default function Labels() {
  const [number, setNumber] = useState("");
  const [locality, setLocality] = useState("");
  const [date, setDate] = useState("");
  const [results, setResults] = useState<CollectingEvent[]>([]);
  const [searched, setSearched] = useState(false);
  const [event, setEvent] = useState<CollectingEvent | null>(null);
  const [count, setCount] = useState(36);
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);

  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    void listPage<LabelBatch>("LabelBatch")
      .then((p) => {
        if (active) {
          setBatches((current) => [
            ...current,
            ...p.items.filter((batch) => !current.some((item) => item.id === batch.id)),
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
    if (guard.current) return;
    setEvent(null);
    setMessage("");
    setResults([]);
    setSearched(false);
    void run(async () => {
      if (!number.trim() && !locality.trim() && !date)
        throw new Error(
          "イベント番号・採集地・採集日のいずれかを入力してください。",
        );
      const query = { locality, date };
      const items = number.trim()
        ? [await findEvent(numberValue(number.trim()))].filter((item) =>
            matchesEvent(item, query),
          )
        : await searchEventPages(query, (cursor) =>
            listPage<CollectingEvent>("CollectionRecord", cursor),
          );
      setResults(items);
      setSearched(true);
      if (items.length === 1) setEvent(items[0]);
    });
  }
  function clearSearch() {
    setEvent(null);
    setResults([]);
    setSearched(false);
    setMessage("");
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
            <fieldset disabled={busy} className="stack">
              <Field label="採集イベント番号">
                <input
                  inputMode="numeric"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    clearSearch();
                  }}
                  placeholder="例：2"
                />
              </Field>
              <Field label="採集地（部分一致）">
                <input
                  value={locality}
                  onChange={(e) => {
                    setLocality(e.target.value);
                    clearSearch();
                  }}
                  placeholder="例：名古屋市・Nagoya"
                />
              </Field>
              <Field label="採集日">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    clearSearch();
                  }}
                />
              </Field>
              <small>
                どれか1項目で検索できます。複数入力すると、すべての条件で絞り込みます。
              </small>
              <button className="secondary" type="submit">
                {busy ? "検索・処理中…" : "検索"}
              </button>
            </fieldset>
          </form>
          {searched && (
            <section
              className="panel stack"
              aria-label="採集イベントの検索結果"
            >
              <h2>検索結果（{results.length}件）</h2>
              {!results.length && (
                <p>条件に一致する採集イベントがありません。</p>
              )}
              <div className="event-search-results">
                {results.map((item) => (
                  <button
                    type="button"
                    className="clickable"
                    key={item.id}
                    disabled={busy}
                    aria-pressed={event?.id === item.id}
                    onClick={() => {
                      setEvent(item);
                      setMessage("");
                    }}
                  >
                    <strong>
                      #{item.eventNumber} · {item.localityJapaneseFull}
                    </strong>
                    <small>
                      {item.date} / {item.collector}
                      {event?.id === item.id
                        ? " · 選択中"
                        : " · このイベントを選択"}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          )}
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
            <strong>labels-template_v4.xlsm</strong>
          </p>
          <button
            className="secondary"
            type="button"
            aria-expanded={showTemplateInfo}
            aria-controls="template-info"
            onClick={() => setShowTemplateInfo((current) => !current)}
          >
            {showTemplateInfo ? "説明を閉じる" : "テンプレートの説明を表示"}
          </button>
          {showTemplateInfo && (
            <div id="template-info" className="stack">
              <p className="muted">
                指定のExcelテンプレートの書式・行高・列幅・用紙設定を使います。横3枚×縦12段で、36枚を超える場合は次のページへ続きます。マイクロQRは各ラベルの右上に配置します。
              </p>
              <p className="muted">
                ラベル用ローマ字の3行は各入力欄に対応し、未入力の行は空欄になります。緯度・経度は小数第4位まで印刷します。
              </p>
              <p className="muted">
                出力は .xlsm です。QRは画像として埋め込まれます。印刷倍率100%で試し刷りしてください。
              </p>
            </div>
          )}
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
