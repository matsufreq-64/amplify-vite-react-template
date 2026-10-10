import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { listPage, reserveLabels } from "./api/workflow";
import type { CollectingEvent, LabelBatch } from "./domain";
import { Field, Notice } from "./ui";
import { downloadLabels, loadLabelTemplate } from "./printing/labels";
import {
  searchEventConditions,
  sortEventsNewest,
  type EventSearchCondition,
} from "./eventSearch";
import EventEditor from "./EventEditor";
import { downloadCsv } from "./csv";
export default function Labels() {
  const [conditions, setConditions] = useState<EventSearchCondition[]>([
    { id: 0, field: "locality", operator: "contains", value: "" },
  ]);
  const nextConditionId = useRef(1);
  const [results, setResults] = useState<CollectingEvent[]>([]);
  const [searched, setSearched] = useState(false);
  const [event, setEvent] = useState<CollectingEvent | null>(null);
  const [count, setCount] = useState(36);
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
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
      setProgress("");
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
      const items = await searchEventConditions(
        conditions,
        (cursor) => listPage<CollectingEvent>("CollectionRecord", cursor),
        (count) => setProgress(`${count}件が一致・次のページを検索中…`),
      );
      setResults(items);
      setSearched(true);
    });
  }
  function updateCondition(id: number, change: Partial<EventSearchCondition>) {
    setConditions((current) => current.map((condition) =>
      condition.id === id ? { ...condition, ...change } : condition,
    ));
  }
  function exportEvents() {
    downloadCsv(
      [
        ["内部ID", "イベント番号", "採集地", "ラベル地名", "ローマ字", "ラベル1行目（ローマ字）", "ラベル2行目（ローマ字）", "ラベル3行目（ローマ字）", "緯度", "経度", "標高", "採集日", "採集者", "方法", "メモ"],
        ...results.map((item) => [
          item.id, item.eventNumber, item.localityJapaneseFull,
          item.localityJapaneseShort, item.localityRomaji,
          item.localityRomaji_1, item.localityRomaji_2, item.localityRomaji_3,
          item.latitude, item.longitude, item.altitude, item.date,
          item.collector, item.method, item.memo,
        ]),
      ],
      "collecting-events.csv",
    );
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">02 / COLLECTION EVENTS & LABELS</span>
          <h1>採集イベント編集・ラベル印刷</h1>
          <p>採集イベントを検索し、記録の編集やデータラベルの作成を行います。</p>
        </div>
      </div>
      <Notice error={error} message={message} />
      <form className="panel stack event-search-panel" onSubmit={search}>
        <div>
          <h2>採集イベント検索</h2>
          <p className="muted">条件を指定してデータを取得</p>
        </div>
        <fieldset disabled={busy} className="stack">
          <strong>検索条件</strong>
          {conditions.map((condition, index) => (
            <div className="event-search-condition" key={condition.id}>
              {index > 0 && <span className="event-search-and">AND</span>}
              <div className="event-search-selects">
                <select aria-label={`条件${index + 1}の項目`} value={condition.field} onChange={(e) => {
                  const field = e.target.value as EventSearchCondition["field"];
                  updateCondition(condition.id, { field, operator: field === "date" ? "equals" : "contains", value: "" });
                }}>
                  <option value="locality">採集地</option>
                  <option value="date">採集日</option>
                  <option value="eventNumber">イベント番号</option>
                  <option value="collector">採集者</option>
                  <option value="method">採集方法</option>
                </select>
                <select aria-label={`条件${index + 1}の一致方法`} value={condition.operator} onChange={(e) => updateCondition(condition.id, { operator: e.target.value as EventSearchCondition["operator"] })}>
                  {condition.field === "date" ? <>
                    <option value="equals">一致する</option>
                    <option value="after">以降</option>
                    <option value="before">以前</option>
                  </> : <>
                    <option value="contains">含む</option>
                    <option value="equals">一致する</option>
                  </>}
                </select>
              </div>
              <div className="event-search-value">
                <input aria-label={`条件${index + 1}の検索値`} type={condition.field === "date" ? "date" : "text"} inputMode={condition.field === "eventNumber" ? "numeric" : undefined} value={condition.value} onChange={(e) => updateCondition(condition.id, { value: e.target.value })} placeholder={condition.field === "locality" ? "例：豊田市" : "検索する値"} />
                {conditions.length > 1 && <button className="secondary" type="button" onClick={() => setConditions((current) => current.filter((item) => item.id !== condition.id))} aria-label={`条件${index + 1}を削除`}>削除</button>}
              </div>
            </div>
          ))}
          <div className="event-search-actions">
            <button className="secondary" type="button" onClick={() => setConditions((current) => [...current, { id: nextConditionId.current++, field: "locality", operator: "contains", value: "" }])}>＋ 条件追加（AND）</button>
            <button className="primary" type="submit">{busy ? "検索中…" : "検索する"}</button>
          </div>
        </fieldset>
        {progress && <p role="status" className="muted">{progress}</p>}
      </form>
      <section className="panel stack" aria-label="採集イベントの検索結果">
        <div className="section-heading">
          <h2>採集イベント検索結果{searched ? `（${results.length}件）` : ""}</h2>
          <span className="muted">採集日の降順・同日の場合はイベント番号の降順</span>
        </div>
        {!searched ? <div className="empty">検索条件を入力して「検索する」を押してください。初期状態ではイベントを読み込みません。</div> : results.length === 0 ? <div className="empty">条件に一致する採集イベントがありません。</div> : <>
          <div className="event-results-scroll">
            <table className="event-results-table">
              <thead><tr><th scope="col">イベント番号</th><th scope="col">採集地</th><th scope="col">採集日 ↓</th><th scope="col">採集者</th><th scope="col">採集方法</th><th scope="col">操作</th></tr></thead>
              <tbody>{results.map((item) => <tr key={item.id} className={event?.id === item.id ? "selected" : ""}>
                <td>{String(item.eventNumber).padStart(8, "0")}</td>
                <td>{item.localityJapaneseFull}</td>
                <td>{item.date.replace(/-/g, "/")}</td><td>{item.collector}</td><td>{item.method || "—"}</td>
                <td><button type="button" className="secondary event-table-action" aria-expanded={event?.id === item.id} aria-controls="event-detail" onClick={() => { setEvent(item); setMessage(""); window.setTimeout(() => document.getElementById("event-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}>詳細</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div><button className="secondary" type="button" onClick={exportEvents}>検索結果をCSV出力</button></div>
        </>}
      </section>
      {event && <div id="event-detail" className="stack" aria-label="採集イベント詳細">
        <EventEditor key={event.id} event={event} onSaved={(saved) => { setEvent(saved); setResults((current) => sortEventsNewest(current.map((item) => item.id === saved.id ? saved : item))); }} />
        <div className="two-column">
          <section className="panel stack">
            <h2>データラベルを印刷</h2>
            <Field label="必要なラベル枚数（1〜80枚）" hint="使わなかった番号は欠番になります。"><input disabled={busy} type="number" min={1} max={80} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
            <button className="primary" disabled={busy || !Number.isInteger(count) || count < 1 || count > 80} onClick={() => void run(async () => {
              const templateBytes = await loadLabelTemplate();
              const batch = await reserveLabels(event.eventNumber, count);
              setBatches((v) => [batch, ...v.filter((b) => b.id !== batch.id)]);
              setMessage(`標本番号 ${batch.firstNumber}〜${batch.firstNumber + batch.count - 1} を確保しました。ダウンロードに失敗した場合は発行履歴から再作成できます。`);
              await downloadLabels(batch, templateBytes);
            })}>{busy ? "処理しています…" : "番号を確保してExcelを作成"}</button>
            <small>この操作では標本レコードは作成されません。</small>
          </section>
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
      </div>}
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
        {batches.length > 0 && <div className="event-results-scroll">
          <table className="event-results-table label-history-table">
            <thead><tr><th scope="col">イベント番号</th><th scope="col">標本番号</th><th scope="col">枚数</th><th scope="col">発行日時 ↓</th><th scope="col">操作</th></tr></thead>
            <tbody>{[...batches]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((b) => <tr key={b.id}>
                <td>{String(b.eventNumber).padStart(8, "0")}</td>
                <td>SP {b.firstNumber}〜{b.firstNumber + b.count - 1}</td>
                <td>{b.count}枚</td>
                <td>{new Date(b.createdAt).toLocaleString("ja-JP")}</td>
                <td><button className="secondary event-table-action" type="button" disabled={busy} onClick={() => void run(() => downloadLabels(b))}>Excelを再作成</button></td>
              </tr>)}</tbody>
          </table>
        </div>}
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
