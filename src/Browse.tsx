import { errorText } from "./errors";
import { useEffect, useRef, useState } from "react";
import { listPage, lookupSpecimen } from "./api/workflow";
import {
  specimenLabel,
  type CollectingEvent,
  type Specimen,
  type SpecimenDetail,
} from "./domain";
import { EventSummary, Field, Notice } from "./ui";
import { downloadBlob } from "./printing/labels";
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
}
function csv(rows: unknown[][], name: string) {
  downloadBlob(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
    name,
  );
}
export default function Browse() {
  const [model, setModel] = useState("CollectionRecord");
  const [items, setItems] = useState<(CollectingEvent | Specimen)[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<SpecimenDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allHistory, setAllHistory] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    void listPage<CollectingEvent | Specimen>(model)
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
  }, [model]);
  const filtered = items.filter((t) =>
    ("eventNumber" in t
      ? `${t.eventNumber} ${t.date} ${t.localityJapaneseFull} ${t.collector}`
      : `${t.specimenNumber} ${t.memo}`
    )
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
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
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">COLLECTION / RECORDS</span>
          <h1>登録データを見る</h1>
          <p>採集記録と標本を確認し、表示対象をCSVに出力します。</p>
        </div>
      </div>
      <Notice error={error} />
      <section className="panel stack">
        <div className="toolbar">
          <div className="segmented">
            {[
              ["CollectionRecord", "採集イベント"],
              ["Specimen", "標本"],
            ].map(([key, label]) => (
              <button
                disabled={busy}
                key={key}
                className={model === key ? "selected" : ""}
                onClick={() => {
                  setModel(key);
                  setItems([]);
                  setCursor(null);
                  setQuery("");
                  setDetail(null);
                  setError("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="badge">読み込み済み {items.length}件</span>
        </div>
        <Field
          label={
            model === "CollectionRecord"
              ? "読み込み済みデータを検索（番号・日付・採集地・採集者）"
              : "読み込み済みデータを検索（標本番号・メモ）"
          }
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索語を入力"
          />
        </Field>
        {model === "Specimen" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={allHistory}
              onChange={(e) => setAllHistory(e.target.checked)}
            />
            CSVに全同定履歴を含める（オフなら現在の同定のみ）
          </label>
        )}
        <button
          className="secondary"
          disabled={busy || !filtered.length}
          onClick={() =>
            void run(async () => {
              if (model === "CollectionRecord") {
                const events = filtered as CollectingEvent[];
                csv(
                  [
                    [
                      "内部ID",
                      "イベント番号",
                      "採集地",
                      "ラベル地名",
                      "ローマ字",
                      "緯度",
                      "経度",
                      "標高",
                      "採集日",
                      "採集者",
                      "方法",
                      "メモ",
                    ],
                    ...events.map((e) => [
                      e.id,
                      e.eventNumber,
                      e.localityJapaneseFull,
                      e.localityJapaneseShort,
                      e.localityRomaji,
                      e.latitude,
                      e.longitude,
                      e.altitude,
                      e.date,
                      e.collector,
                      e.method,
                      e.memo,
                    ]),
                  ],
                  "collecting-events.csv",
                );
              } else {
                const rows: unknown[][] = [
                  [
                    "標本ID",
                    "標本番号",
                    "採集イベントID",
                    "イベント番号",
                    "採集地",
                    "採集日",
                    "性別",
                    "標本メモ",
                    "同定ID",
                    "和名",
                    "学名",
                    "同定日",
                    "同定者",
                    "同定メモ",
                    "追加順",
                    "現在の同定",
                  ],
                ];
                for (const s of filtered as Specimen[]) {
                  const d = await lookupSpecimen(s.specimenNumber);
                  const histories = allHistory
                    ? d.history
                    : d.history.slice(0, 1);
                  for (const h of histories.length ? histories : [null])
                    rows.push([
                      s.id,
                      s.specimenNumber,
                      s.collectingEventId,
                      d.event.eventNumber,
                      d.event.localityJapaneseFull,
                      d.event.date,
                      s.sex,
                      s.memo,
                      h?.id,
                      h?.japaneseName,
                      h?.scientificName,
                      h?.identifiedAt,
                      h?.identifiedBy,
                      h?.memo,
                      h?.sequence,
                      h ? h.id === d.history[0]?.id : "未同定",
                    ]);
                }
                csv(
                  rows,
                  allHistory
                    ? "specimens-all-history.csv"
                    : "specimens-current-identification.csv",
                );
              }
            })
          }
        >
          {busy ? "処理しています…" : `表示中の ${filtered.length} 件をCSV出力`}
        </button>
        {!filtered.length && (
          <div className="empty">
            表示できるデータはありません。次のページがある場合は読み込んでください。
          </div>
        )}
        {filtered.map((item) =>
          "eventNumber" in item ? (
            <EventSummary key={item.id} event={item} />
          ) : (
            <button
              className="list-row clickable"
              disabled={busy}
              key={item.id}
              onClick={() =>
                void run(async () =>
                  setDetail(await lookupSpecimen(item.specimenNumber)),
                )
              }
            >
              <strong>{specimenLabel(item.specimenNumber)}</strong>
              <span>{item.memo || "詳細・同定履歴を見る"} →</span>
            </button>
          ),
        )}
        {cursor && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const p = await listPage<CollectingEvent | Specimen>(
                  model,
                  cursor,
                );
                setItems((v) => [
                  ...v,
                  ...p.items.filter((t) => !v.some((old) => old.id === t.id)),
                ]);
                setCursor(p.cursor);
              })
            }
          >
            次のページを読み込む
          </button>
        )}
      </section>
      {detail && (
        <section className="panel stack">
          <div className="section-heading">
            <h2>{specimenLabel(detail.specimen!.specimenNumber)}</h2>
            <button className="secondary" onClick={() => setDetail(null)}>
              閉じる
            </button>
          </div>
          <EventSummary event={detail.event} />
          <p>
            性別：
            {(
              {
                male: "オス",
                female: "メス",
                unknown: "不明",
                unexamined: "未判定",
              } as Record<string, string>
            )[detail.specimen!.sex] || "未判定"}
          </p>
          <p>{detail.specimen?.memo}</p>
          <h3>同定履歴</h3>
          {!detail.history.length && <p>未同定</p>}
          {detail.history.map((h, i) => (
            <article className="history" key={h.id}>
              <strong>
                {h.japaneseName || "和名なし"}{" "}
                {i === 0 && <span className="badge">現在の同定</span>}
              </strong>
              <i>{h.scientificName}</i>
              <small>
                {h.identifiedAt} / {h.identifiedBy}
              </small>
              <p>{h.memo}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
