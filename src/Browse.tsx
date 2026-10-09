import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
import { EventSummary, Field, Notice } from "./ui";
import { downloadCsv } from "./csv";
import QrScanner from "./components/QrScanner";
import { numberValue, parseQr } from "./domain";
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
  const [model, setModel] = useState("CollectionRecord");
  const [items, setItems] = useState<(CollectingEvent | Specimen)[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupEventNumber, setLookupEventNumber] = useState("");
  const [camera, setCamera] = useState(false);
  const [detail, setDetail] = useState<SpecimenDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allHistory, setAllHistory] = useState(false);
  const [allRecords, setAllRecords] = useState(true);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [editingEvent, setEditingEvent] = useState<CollectingEvent | null>(
    null,
  );
  const [eventDraft, setEventDraft] = useState<EventInput | null>(null);
  const [editingSpecimen, setEditingSpecimen] = useState(false);
  const [editingIdentification, setEditingIdentification] = useState(false);
  const [identificationDraft, setIdentificationDraft] =
    useState<IdentificationInput>({
      japaneseName: "",
      scientificName: "",
      identifiedAt: "",
      identifiedBy: "",
      memo: "",
    });
  const [specimenDraft, setSpecimenDraft] = useState({
    sex: "unexamined",
    memo: "",
  });
  const [audit, setAudit] = useState<EditHistory[] | null>(null);
  const [auditTarget, setAuditTarget] = useState("");
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
  const matches = (t: CollectingEvent | Specimen) =>
    ("eventNumber" in t
      ? `${t.eventNumber} ${t.date} ${t.localityJapaneseFull} ${t.collector}`
      : `${t.specimenNumber} ${t.memo}`
    )
      .toLowerCase()
      .includes(query.toLowerCase());
  const filtered = items.filter(matches);
  async function exportItems() {
    if (!allRecords) return filtered;
    const found = new Map<string, CollectingEvent | Specimen>();
    let next: string | null | undefined;
    do {
      const page = await listPage<CollectingEvent | Specimen>(model, next);
      for (const item of page.items)
        if (matches(item)) found.set(item.id, item);
      next = page.cursor;
      setProgress(`${found.size}件を取得中…`);
    } while (next);
    return [...found.values()];
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
    setIdentificationDraft({
      japaneseName: current?.japaneseName ?? "",
      scientificName: current?.scientificName ?? "",
      identifiedAt: current?.identifiedAt ?? "",
      identifiedBy: current?.identifiedBy ?? "",
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
      setDetail(found);
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
          <span className="eyebrow">COLLECTION / RECORDS</span>
          <h1>データ編集・出力</h1>
          <p>
            QRや番号から標本を探し、同定・登録内容の編集とCSV出力を行います。
          </p>
        </div>
      </div>
      <Notice error={error} message={message} />
      <section className="panel stack">
        <h2>QR・標本番号で検索</h2>
        <div className="toolbar">
          <button
            type="button"
            className="scan-button"
            disabled={busy}
            onClick={() => setCamera((current) => !current)}
          >
            {camera ? "カメラを閉じる" : "▣ QRを読み取る"}
          </button>
        </div>
        {camera && <QrScanner onScan={scan} />}
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              openSpecimen(
                numberValue(lookupNumber),
                lookupEventNumber ? numberValue(lookupEventNumber) : undefined,
              );
            } catch (caught) {
              setError(errorText(caught));
            }
          }}
        >
          <fieldset className="stack" disabled={busy}>
            <div className="form-grid">
              <Field label="標本番号">
                <input
                  inputMode="numeric"
                  required
                  value={lookupNumber}
                  onChange={(e) => setLookupNumber(e.target.value)}
                  placeholder="例：103"
                />
              </Field>
              <Field label="採集イベント番号（任意）">
                <input
                  inputMode="numeric"
                  value={lookupEventNumber}
                  onChange={(e) => setLookupEventNumber(e.target.value)}
                  placeholder="例：2"
                />
              </Field>
            </div>
            <button className="primary" type="submit">
              標本を検索
            </button>
          </fieldset>
        </form>
      </section>
      <section className="panel stack" style={{ order: 2 }}>
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
                  setEditingEvent(null);
                  setEventDraft(null);
                  setEditingSpecimen(false);
                  setEditingIdentification(false);
                  setAudit(null);
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
        <label className="checkbox">
          <input
            type="checkbox"
            checked={allRecords}
            disabled={busy}
            onChange={(e) => setAllRecords(e.target.checked)}
          />
          全ページの該当データをCSVに出力する
        </label>
        <small>
          {allRecords
            ? "検索語がある場合も全ページから探します。件数によっては時間がかかります。"
            : "画面に読み込み済みの該当データだけを出力します。"}
        </small>
        <button
          className="secondary"
          disabled={busy || (!allRecords && !filtered.length)}
          onClick={() =>
            void run(async () => {
              const exportRows = await exportItems();
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
          {busy
            ? progress || "処理しています…"
            : allRecords
              ? "該当する全データをCSV出力"
              : `読み込み済みの ${filtered.length} 件をCSV出力`}
        </button>
        {!filtered.length && (
          <div className="empty">
            表示できるデータはありません。次のページがある場合は読み込んでください。
          </div>
        )}
        {filtered.map((item) =>
          "eventNumber" in item ? (
            <div key={item.id} className="stack browse-item">
              <EventSummary event={item} />
              <div className="toolbar">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => editEvent(item)}
                >
                  この採集イベントを編集
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => showAudit("CollectionRecord", item.id)}
                >
                  変更履歴
                </button>
              </div>
            </div>
          ) : (
            <button
              className="list-row clickable"
              disabled={busy}
              key={item.id}
              onClick={() =>
                void run(async () => {
                  const found = await lookupSpecimen(item.specimenNumber);
                  if (!found.specimen)
                    throw new Error("この標本はまだ登録されていません。");
                  setDetail(found);
                  setEditingSpecimen(false);
                  setEditingIdentification(false);
                  setAudit(null);
                })
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
      {editingEvent && eventDraft && (
        <form className="panel stack" onSubmit={saveEvent} style={{ order: 3 }}>
          <h2>採集イベント #{editingEvent.eventNumber} を編集</h2>
          <small>
            イベント番号は変更できません。発行済みラベルには発行時の採集情報が残ります。
          </small>
          <fieldset className="stack" disabled={busy}>
            <div className="form-grid">
              {eventFields.map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type={key === "date" ? "date" : "text"}
                    required={
                      key === "localityJapaneseFull" ||
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
              ))}
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
        <section className="panel stack" style={{ order: 1 }}>
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
          style={{ order: 4 }}
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
