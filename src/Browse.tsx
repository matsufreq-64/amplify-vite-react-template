import { errorText } from "./errors";
import { useRef, useState, type FormEvent } from "react";
import {
  addIdentification,
  listEditHistory,
  listPage,
  lookupSpecimen,
  updateEvent,
  updateSpecimen,
} from "./api/workflow";
import {
  specimenLabel,
  type CollectingEvent,
  type Specimen,
  type SpecimenDetail,
  type EditHistory,
  type EventInput,
  type IdentificationInput,
} from "./domain";
import { CollectingMethodField, EventSummary, Field, Notice } from "./ui";
import { downloadCsv } from "./csv";
import MicroQrScanner from "./components/MicroQrScanner";
import { numberValue, parseQr } from "./domain";
import { initialIdentification } from "./registrationDefaults";
import { eventSummariesForSpecimens } from "./specimenEvents";
import { matchesSpecimenConditions, sortSpecimensNewest, type SpecimenSearchCondition } from "./specimenSearch";
const eventFields = [
  ["localityJapaneseFull", "採集地（正式表記）"],
  ["localityJapaneseShort", "ラベル用の短い地名"],
  ["localityRomaji_1", "ラベル1行目（ローマ字）"],
  ["localityRomaji_2", "ラベル2行目（ローマ字）"],
  ["localityRomaji_3", "ラベル3行目（ローマ字）"],
  ["date", "採集日"],
  ["collector", "採集者"],
  ["method", "採集方法"],
  ["memo", "メモ"],
] as const;
const historyLabels: Record<string, string> = {
  location: "採集地",
  locationLabel: "ラベル用の短い地名",
  locationRomaji: "旧ローマ字",
  localityRomaji_1: "ラベル1行目",
  localityRomaji_2: "ラベル2行目",
  localityRomaji_3: "ラベル3行目",
  latitude: "緯度",
  longitude: "経度",
  altitude: "標高",
  date: "採集日",
  collector: "採集者",
  collectingMethod: "採集方法",
  memo: "メモ",
  sex: "性別",
};
const eventInput = (event: CollectingEvent): EventInput => ({
  localityJapaneseFull: event.localityJapaneseFull,
  localityJapaneseShort: event.localityJapaneseShort,
  localityRomaji: event.localityRomaji,
  localityRomaji_1: event.localityRomaji_1,
  localityRomaji_2: event.localityRomaji_2,
  localityRomaji_3: event.localityRomaji_3,
  latitude: event.latitude,
  longitude: event.longitude,
  altitude: event.altitude,
  date: event.date,
  collector: event.collector,
  method: event.method,
  memo: event.memo,
});
export default function Browse() {
  const [model, setModel] = useState("Specimen");
  const [items, setItems] = useState<(CollectingEvent | Specimen)[]>([]);
  const [eventSummaries, setEventSummaries] = useState<Record<string, CollectingEvent>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [conditions, setConditions] = useState<SpecimenSearchCondition[]>([
    { id: 0, field: "locality", operator: "contains", value: "" },
  ]);
  const nextConditionId = useRef(1);
  const [searchedRecords, setSearchedRecords] = useState(false);
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupEventNumber, setLookupEventNumber] = useState("");
  const [camera, setCamera] = useState(false);
  const [detail, setDetail] = useState<SpecimenDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allHistory, setAllHistory] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [editingEvent, setEditingEvent] = useState<CollectingEvent | null>(
    null,
  );
  const [eventDraft, setEventDraft] = useState<EventInput | null>(null);
  const [editingSpecimen, setEditingSpecimen] = useState(false);
  const [editingIdentification, setEditingIdentification] = useState(false);
  const [identificationDraft, setIdentificationDraft] =
    useState<IdentificationInput>(initialIdentification);
  const [specimenDraft, setSpecimenDraft] = useState({
    sex: "unexamined",
    memo: "",
  });
  const [audit, setAudit] = useState<EditHistory[] | null>(null);
  const [auditTarget, setAuditTarget] = useState("");
  const guard = useRef(false);
  const filtered = items;
  function updateCondition(id: number, change: Partial<SpecimenSearchCondition>) {
    setConditions((current) => current.map((condition) => condition.id === id ? { ...condition, ...change } : condition));
  }
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
  function searchRecords(e: FormEvent) {
    e.preventDefault();
    let activeConditions = conditions.filter((condition) => condition.value.trim());
    try {
      if (lookupEventNumber.trim()) activeConditions = [...activeConditions, { id: -1, field: "eventNumber", operator: "equals", value: String(numberValue(lookupEventNumber)) }];
      if (lookupNumber.trim()) activeConditions = [...activeConditions, { id: -2, field: "specimenNumber", operator: "equals", value: String(numberValue(lookupNumber)) }];
    } catch (caught) {
      setError(errorText(caught));
      return;
    }
    void run(async () => {
      setDetail(null);
      setEditingEvent(null);
      setEventDraft(null);
      setEditingSpecimen(false);
      setEditingIdentification(false);
      setAudit(null);
      setMessage("");
      setItems([]);
      setCursor(null);
      setSearchedRecords(false);
      const found = new Map<string, Specimen>();
      let next: string | null | undefined;
      do {
        const page = await listPage<Specimen>("Specimen", next);
        for (const item of page.items) found.set(item.id, item);
        next = page.cursor;
        setProgress(`${found.size}件を取得中…`);
      } while (next);
      const summaries = await eventSummariesForSpecimens(
        [...found.values()], {},
        (pageCursor) => listPage<CollectingEvent>("CollectionRecord", pageCursor),
      );
      setEventSummaries(summaries);
      setItems(sortSpecimensNewest([...found.values()].filter((item) => matchesSpecimenConditions(item, summaries[item.collectingEventId], activeConditions)), summaries));
      setSearchedRecords(true);
    });
  }
  function editEvent(event: CollectingEvent) {
    setEditingEvent(event);
    setEventDraft(eventInput(event));
    setAudit(null);
    setMessage("");
  }
  function editSpecimen(specimen: Specimen) {
    setEditingSpecimen(true);
    setSpecimenDraft({
      sex: specimen.sex || "unexamined",
      memo: specimen.memo || "",
    });
    setAudit(null);
    setMessage("");
  }
  function editIdentification() {
    const current = detail?.history[0];
    const defaults = initialIdentification();
    setIdentificationDraft({
      japaneseName: current?.japaneseName ?? "",
      scientificName: current?.scientificName ?? "",
      identifiedAt: defaults.identifiedAt,
      identifiedBy: defaults.identifiedBy,
      memo: "",
    });
    setEditingIdentification(true);
    setMessage("");
  }
  function showAudit(targetType: "CollectionRecord" | "Specimen", id: string) {
    void run(async () => {
      setAudit(await listEditHistory(targetType, id));
      setAuditTarget(`${targetType}:${id}`);
    });
  }
  function openSpecimen(specimenNumber: number, eventNumber?: number) {
    setCamera(false);
    void run(async () => {
      setDetail(null);
      const found = await lookupSpecimen(specimenNumber, eventNumber);
      if (!found.specimen)
        throw new Error(
          "この標本はまだ登録されていません。先に標本登録を行ってください。",
        );
      setModel("Specimen");
      setItems([]);
      setCursor(null);
      setSearchedRecords(false);
      setDetail(found);
      setEventSummaries((current) => ({ ...current, [found.event.id]: found.event }));
      setEditingEvent(null);
      setEditingSpecimen(false);
      setEditingIdentification(false);
      setAudit(null);
      setMessage("");
    });
  }
  function scan(value: string) {
    setCamera(false);
    try {
      const parsed = parseQr(value);
      setLookupNumber(String(parsed.specimenNumber));
      setLookupEventNumber(String(parsed.eventNumber));
      openSpecimen(parsed.specimenNumber, parsed.eventNumber);
    } catch (e) {
      setError(errorText(e));
    }
  }
  function saveEvent(e: FormEvent) {
    e.preventDefault();
    if (!editingEvent || !eventDraft) return;
    void run(async () => {
      const saved = await updateEvent(editingEvent, eventDraft);
      setItems((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setEventSummaries((current) => ({ ...current, [saved.id]: saved }));
      setEditingEvent(null);
      setEventDraft(null);
      setAudit(null);
      setMessage(
        `採集イベント #${saved.eventNumber} を更新し、変更履歴を保存しました。`,
      );
    });
  }
  function saveSpecimen(e: FormEvent) {
    e.preventDefault();
    if (!detail?.specimen) return;
    void run(async () => {
      const saved = await updateSpecimen(detail.specimen!, specimenDraft);
      setItems((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setDetail({ ...detail, specimen: saved });
      setEditingSpecimen(false);
      setAudit(null);
      setMessage(
        `${specimenLabel(saved.specimenNumber)} を更新し、変更履歴を保存しました。`,
      );
    });
  }
  function saveIdentification(e: FormEvent) {
    e.preventDefault();
    if (!detail?.specimen) return;
    void run(async () => {
      const added = await addIdentification(
        detail.specimen!.id,
        identificationDraft,
      );
      setDetail({ ...detail, history: [added, ...detail.history] });
      setEditingIdentification(false);
      setMessage("新しい同定を記録しました。以前の名前は同定履歴に残ります。");
    });
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">04 / COLLECTION RECORDS</span>
          <h1>標本データ編集・出力</h1>
          <p>
            マイクロQRや番号から標本を探し、同定・登録内容の編集とCSV出力を行います。
          </p>
        </div>
      </div>
      <Notice error={error} message={message} />
      <form className="panel stack event-search-panel" onSubmit={searchRecords} style={{ order: 1 }}>
        <div><h2>標本を検索</h2><p className="muted">条件や番号を指定してデータを取得</p></div>
        <fieldset className="stack" disabled={busy}>
          <strong>検索条件</strong>
          {conditions.map((condition, index) => <div className="event-search-condition" key={condition.id}>
            {index > 0 && <span className="event-search-and">AND</span>}
            <div className="event-search-selects">
              <select aria-label={`条件${index + 1}の項目`} value={condition.field} onChange={(e) => {
                const field = e.target.value as SpecimenSearchCondition["field"];
                updateCondition(condition.id, { field, operator: field === "date" ? "equals" : "contains", value: "" });
              }}>
                <option value="locality">採集地</option>
                <option value="date">採集日</option>
                <option value="specimenNumber">標本番号</option>
                <option value="eventNumber">イベント番号</option>
                <option value="memo">標本メモ</option>
              </select>
              <select aria-label={`条件${index + 1}の一致方法`} value={condition.operator} onChange={(e) => updateCondition(condition.id, { operator: e.target.value as SpecimenSearchCondition["operator"] })}>
                {condition.field === "date" ? <><option value="equals">一致する</option><option value="after">以降</option><option value="before">以前</option></> : <><option value="contains">含む</option><option value="equals">一致する</option></>}
              </select>
            </div>
            <div className="event-search-value">
              <input aria-label={`条件${index + 1}の検索値`} type={condition.field === "date" ? "date" : "text"} inputMode={condition.field === "specimenNumber" || condition.field === "eventNumber" ? "numeric" : undefined} value={condition.value} onChange={(e) => updateCondition(condition.id, { value: e.target.value })} placeholder={condition.field === "locality" ? "例：豊田市" : "検索する値"} />
              {conditions.length > 1 && <button type="button" className="secondary" onClick={() => setConditions((current) => current.filter((item) => item.id !== condition.id))}>削除</button>}
            </div>
          </div>)}
          <div><button type="button" className="secondary" onClick={() => setConditions((current) => [...current, { id: nextConditionId.current++, field: "locality", operator: "contains", value: "" }])}>＋ 条件追加（AND）</button></div>
          <button type="button" className="scan-button browse-scan-button" onClick={() => setCamera((current) => !current)}>
            {camera ? "カメラを閉じる" : "▣ マイクロQRを読み取る"}
          </button>
          {camera && <MicroQrScanner onScan={scan} />}
          <div className="form-grid">
            <Field label="採集イベント番号（任意）">
              <input inputMode="numeric" value={lookupEventNumber} onChange={(e) => setLookupEventNumber(e.target.value)} placeholder="例：2" />
            </Field>
            <Field label="標本番号（任意）">
              <input inputMode="numeric" value={lookupNumber} onChange={(e) => setLookupNumber(e.target.value)} placeholder="例：103" />
            </Field>
          </div>
          <button type="submit" className="primary">{busy ? progress || "検索中…" : "検索する"}</button>
        </fieldset>
      </form>
      <section className="panel stack" style={{ order: searchedRecords ? 2 : 3 }}>
        <div className="section-heading"><h2>標本の検索結果{searchedRecords ? `（${items.length}件）` : ""}</h2><span className="muted">採集日の降順・同日の場合は標本番号の降順</span></div>
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
        <small>CSVには指定した条件・番号に一致するすべての標本を出力します。</small>
        <button
          className="secondary"
          disabled={busy || !searchedRecords || !filtered.length}
          onClick={() =>
            void run(async () => {
              const exportRows = filtered;
              if (!exportRows.length)
                throw new Error("出力するデータがありません。");
              if (model === "CollectionRecord") {
                const events = exportRows as CollectingEvent[];
                downloadCsv(
                  [
                    [
                      "内部ID",
                      "イベント番号",
                      "採集地",
                      "ラベル地名",
                      "ローマ字",
                      "ラベル1行目（ローマ字）",
                      "ラベル2行目（ローマ字）",
                      "ラベル3行目（ローマ字）",
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
                      e.localityRomaji_1,
                      e.localityRomaji_2,
                      e.localityRomaji_3,
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
                for (const [index, s] of (exportRows as Specimen[]).entries()) {
                  setProgress(
                    `${index + 1} / ${exportRows.length} 件の標本を取得中…`,
                  );
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
                downloadCsv(
                  rows,
                  allHistory
                    ? "specimens-all-history.csv"
                    : "specimens-current-identification.csv",
                );
              }
              setProgress("");
            })
          }
        >
          {busy ? progress || "処理しています…" : `${filtered.length}件をCSV出力`}
        </button>
        {!searchedRecords ? (
          <div className="empty">
            検索すると記録を読み込みます。空欄で検索すると一覧を表示します。
          </div>
        ) : !filtered.length ? (
          <div className="empty">該当するデータはありません。</div>
        ) : null}
        {filtered.length > 0 && <div className="event-results-scroll">
          <table className="event-results-table specimen-results-table">
            <thead><tr><th scope="col">標本番号</th><th scope="col">イベント番号</th><th scope="col">採集地</th><th scope="col">採集日 ↓</th><th scope="col">性別</th><th scope="col">操作</th></tr></thead>
            <tbody>{filtered.map((item) => "eventNumber" in item ? (
              <tr key={item.id}><td colSpan={6}><EventSummary event={item} actions={<><button type="button" className="secondary" onClick={() => editEvent(item)}>この採集イベントを編集</button><button type="button" className="secondary" onClick={() => showAudit("CollectionRecord", item.id)}>変更履歴</button></>} /></td></tr>
            ) : (
              <tr key={item.id} className={detail?.specimen?.id === item.id ? "selected" : ""}>
                <td>{specimenLabel(item.specimenNumber)}</td>
                <td>{eventSummaries[item.collectingEventId] ? String(eventSummaries[item.collectingEventId].eventNumber).padStart(8, "0") : "—"}</td>
                <td>{eventSummaries[item.collectingEventId]?.localityJapaneseFull || "採集情報を取得できませんでした"}</td>
                <td>{eventSummaries[item.collectingEventId]?.date.replace(/-/g, "/") || "—"}</td>
                <td>{item.sex === "male" ? "♂ オス" : item.sex === "female" ? "♀ メス" : item.sex === "unknown" ? "不明" : "未判定"}</td>
                <td><button type="button" className="secondary event-table-action" disabled={busy} onClick={() => void run(async () => {
                  const found = await lookupSpecimen(item.specimenNumber);
                  if (!found.specimen) throw new Error("この標本はまだ登録されていません。");
                  setDetail(found);
                  setEventSummaries((current) => ({ ...current, [found.event.id]: found.event }));
                  setEditingSpecimen(false);
                  setEditingIdentification(false);
                  setAudit(null);
                })}>詳細</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>}
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
                if (model === "Specimen")
                  setEventSummaries(await eventSummariesForSpecimens(
                    p.items as Specimen[], eventSummaries,
                    (nextCursor) => listPage<CollectingEvent>("CollectionRecord", nextCursor),
                  ));
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
      {editingEvent && eventDraft && (
        <form className="panel stack" onSubmit={saveEvent} style={{ order: 4 }}>
          <h2>採集イベント #{editingEvent.eventNumber} を編集</h2>
          <small>
            イベント番号は変更できません。発行済みラベルには発行時の採集情報が残ります。
          </small>
          <fieldset className="stack" disabled={busy}>
            <div className="form-grid">
              {eventFields.map(([key, label]) =>
                key === "method" ? (
                  <CollectingMethodField
                    key={key}
                    value={eventDraft.method}
                    onChange={(value) =>
                      setEventDraft(
                        (current) => current && { ...current, method: value },
                      )
                    }
                  />
                ) : (
                  <Field key={key} label={label}>
                    <input
                      type={key === "date" ? "date" : "text"}
                      required={
                        key === "localityJapaneseFull" ||
                        key === "localityRomaji_1" ||
                        key === "localityRomaji_2" ||
                        key === "collector" ||
                        key === "date"
                      }
                      value={eventDraft[key] ?? ""}
                      onChange={(e) =>
                        setEventDraft(
                          (current) =>
                            current && { ...current, [key]: e.target.value },
                        )
                      }
                    />
                  </Field>
                ),
              )}
            </div>
            <div className="form-grid three">
              {(["latitude", "longitude", "altitude"] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      latitude: "緯度",
                      longitude: "経度",
                      altitude: "標高 / m",
                    }[key]
                  }
                >
                  <input
                    type="number"
                    step={key === "altitude" ? "1" : "0.0001"}
                    min={
                      key === "latitude"
                        ? -90
                        : key === "longitude"
                          ? -180
                          : undefined
                    }
                    max={
                      key === "latitude"
                        ? 90
                        : key === "longitude"
                          ? 180
                          : undefined
                    }
                    value={eventDraft[key] ?? ""}
                    onChange={(e) =>
                      setEventDraft(
                        (current) =>
                          current && {
                            ...current,
                            [key]:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          },
                      )
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="toolbar">
              <button className="primary" type="submit">
                変更を保存
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setEditingEvent(null);
                  setEventDraft(null);
                }}
              >
                キャンセル
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {detail && (
        <section className="panel stack" style={{ order: searchedRecords ? 3 : 1 }}>
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
          <div className="toolbar">
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => editSpecimen(detail.specimen!)}
            >
              性別・メモを編集
            </button>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => showAudit("Specimen", detail.specimen!.id)}
            >
              変更履歴
            </button>
          </div>
          {editingSpecimen && (
            <form className="stack" onSubmit={saveSpecimen}>
              <fieldset className="stack" disabled={busy}>
                <Field label="性別">
                  <select
                    value={specimenDraft.sex}
                    onChange={(e) =>
                      setSpecimenDraft((current) => ({
                        ...current,
                        sex: e.target.value,
                      }))
                    }
                  >
                    <option value="unexamined">未判定</option>
                    <option value="male">オス</option>
                    <option value="female">メス</option>
                    <option value="unknown">不明</option>
                  </select>
                </Field>
                <Field label="標本メモ">
                  <textarea
                    rows={3}
                    value={specimenDraft.memo}
                    onChange={(e) =>
                      setSpecimenDraft((current) => ({
                        ...current,
                        memo: e.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="toolbar">
                  <button className="primary" type="submit">
                    変更を保存
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setEditingSpecimen(false)}
                  >
                    キャンセル
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          <h3>同定履歴</h3>
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={editIdentification}
          >
            同定結果を更新（履歴を追加）
          </button>
          {editingIdentification && (
            <form className="stack" onSubmit={saveIdentification}>
              <fieldset className="stack" disabled={busy}>
                <div className="form-grid">
                  <Field label="和名">
                    <input
                      value={identificationDraft.japaneseName}
                      onChange={(e) =>
                        setIdentificationDraft((current) => ({
                          ...current,
                          japaneseName: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="学名">
                    <input
                      value={identificationDraft.scientificName}
                      onChange={(e) =>
                        setIdentificationDraft((current) => ({
                          ...current,
                          scientificName: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="同定日">
                    <input
                      type="date"
                      value={identificationDraft.identifiedAt}
                      onChange={(e) =>
                        setIdentificationDraft((current) => ({
                          ...current,
                          identifiedAt: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="同定者">
                    <input
                      value={identificationDraft.identifiedBy}
                      onChange={(e) =>
                        setIdentificationDraft((current) => ({
                          ...current,
                          identifiedBy: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="訂正理由・メモ">
                  <textarea
                    rows={2}
                    value={identificationDraft.memo}
                    onChange={(e) =>
                      setIdentificationDraft((current) => ({
                        ...current,
                        memo: e.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="toolbar">
                  <button
                    className="primary"
                    type="submit"
                    disabled={
                      !identificationDraft.japaneseName.trim() &&
                      !identificationDraft.scientificName.trim()
                    }
                  >
                    新しい同定を保存
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setEditingIdentification(false)}
                  >
                    キャンセル
                  </button>
                </div>
              </fieldset>
            </form>
          )}
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
      {audit && (
        <section
          className="panel stack"
          aria-label="変更履歴"
          style={{ order: 5 }}
        >
          <h2>変更履歴</h2>
          {!audit.length && <p>このデータの変更履歴はまだありません。</p>}
          {audit.map((entry) => (
            <article className="history" key={entry.id}>
              <strong>
                {new Date(entry.changedAt).toLocaleString("ja-JP")} /{" "}
                {entry.editor}
              </strong>
              {Object.keys(entry.after)
                .filter(
                  (key) =>
                    JSON.stringify(entry.before[key] ?? null) !==
                    JSON.stringify(entry.after[key] ?? null),
                )
                .map((key) => (
                  <p key={key}>
                    {historyLabels[key] || key}：
                    {String(entry.before[key] ?? "（空欄）")} →{" "}
                    {String(entry.after[key] ?? "（空欄）")}
                  </p>
                ))}
            </article>
          ))}
          <small>
            対象：
            {auditTarget.startsWith("Specimen:") ? "標本" : "採集イベント"}
          </small>
        </section>
      )}
    </div>
  );
}
