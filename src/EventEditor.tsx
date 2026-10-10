import { useState, type FormEvent } from "react";
import { listEditHistory, updateEvent } from "./api/workflow";
import type { CollectingEvent, EditHistory, EventInput } from "./domain";
import { errorText } from "./errors";
import { CollectingMethodField, EventSummary, Field, Notice } from "./ui";

const fields = [
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
};
const toInput = (event: CollectingEvent): EventInput => ({
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

export default function EventEditor({
  event,
  onSaved,
}: {
  event: CollectingEvent;
  onSaved: (saved: CollectingEvent) => void;
}) {
  const [draft, setDraft] = useState<EventInput | null>(null);
  const [history, setHistory] = useState<EditHistory[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function showHistory() {
    setBusy(true);
    setError("");
    try {
      setHistory(await listEditHistory("CollectionRecord", event.id));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await updateEvent(event, draft);
      onSaved(saved);
      setDraft(null);
      setHistory(null);
      setMessage(`採集イベント #${saved.eventNumber} を更新し、変更履歴を保存しました。`);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <EventSummary event={event} actions={
        <>
          <button className="secondary" type="button" disabled={busy} onClick={() => {
            setDraft(toInput(event));
            setHistory(null);
            setMessage("");
          }}>この採集イベントを編集</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => void showHistory()}>変更履歴</button>
        </>
      } />
      <Notice error={error} message={message} />
      {draft && (
        <form className="panel stack" onSubmit={save}>
          <h2>採集イベント #{event.eventNumber} を編集</h2>
          <small>イベント番号は変更できません。発行済みラベルには発行時の採集情報が残ります。</small>
          <fieldset className="stack" disabled={busy}>
            <div className="form-grid">
              {fields.map(([key, label]) => key === "method" ? (
                <CollectingMethodField key={key} value={draft.method} onChange={(value) =>
                  setDraft((current) => current && { ...current, method: value })
                } />
              ) : (
                <Field key={key} label={label}>
                  <input
                    type={key === "date" ? "date" : "text"}
                    required={key === "localityJapaneseFull" || key === "localityRomaji_1" || key === "localityRomaji_2" || key === "collector" || key === "date"}
                    value={draft[key] ?? ""}
                    onChange={(e) => setDraft((current) => current && { ...current, [key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            <div className="form-grid three">
              {(["latitude", "longitude", "altitude"] as const).map((key) => (
                <Field key={key} label={{ latitude: "緯度", longitude: "経度", altitude: "標高 / m" }[key]}>
                  <input
                    type="number"
                    step={key === "altitude" ? "1" : "0.0001"}
                    min={key === "latitude" ? -90 : key === "longitude" ? -180 : undefined}
                    max={key === "latitude" ? 90 : key === "longitude" ? 180 : undefined}
                    value={draft[key] ?? ""}
                    onChange={(e) => setDraft((current) => current && {
                      ...current,
                      [key]: e.target.value === "" ? undefined : Number(e.target.value),
                    })}
                  />
                </Field>
              ))}
            </div>
            <div className="toolbar">
              <button className="primary" type="submit">変更を保存</button>
              <button className="secondary" type="button" onClick={() => setDraft(null)}>キャンセル</button>
            </div>
          </fieldset>
        </form>
      )}
      {history && (
        <section className="panel stack" aria-label="採集イベントの変更履歴">
          <h2>変更履歴</h2>
          {!history.length && <p>このデータの変更履歴はまだありません。</p>}
          {history.map((entry) => (
            <article className="history" key={entry.id}>
              <strong>{new Date(entry.changedAt).toLocaleString("ja-JP")} / {entry.editor}</strong>
              {Object.keys(entry.after)
                .filter((key) => JSON.stringify(entry.before[key] ?? null) !== JSON.stringify(entry.after[key] ?? null))
                .map((key) => (
                  <p key={key}>{historyLabels[key] || key}：{String(entry.before[key] ?? "（空欄）")} → {String(entry.after[key] ?? "（空欄）")}</p>
                ))}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
