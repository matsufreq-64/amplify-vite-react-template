import { errorText } from "./errors";
import { useRef, useState, type FormEvent } from "react";
import CollectionMap from "./components/CollectionMap";
import { fetchElevation, fetchHeartRailsPlace } from "./api/location";
import { createEvent } from "./api/workflow";
import type { CollectingEvent, EventInput } from "./domain";
import { Field, Notice, EventSummary } from "./ui";
import {
  getDefaultCollector,
  roundAltitude,
  roundCoordinate,
} from "./registrationDefaults";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const empty = (): EventInput => ({
  localityJapaneseFull: "",
  localityJapaneseShort: "",
  localityRomaji: "",
  localityRomaji_1: "",
  localityRomaji_2: "",
  localityRomaji_3: "",
  date: today(),
  collector: getDefaultCollector(),
  method: "",
  memo: "",
});
export default function App() {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [saved, setSaved] = useState<CollectingEvent | null>(null);
  const generation = useRef(0);
  const saving = useRef(false);
  function update<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    generation.current++;
    setLocating(false);
    setForm((v) => ({ ...v, [key]: value }));
  }
  async function selectPosition(latitude: number, longitude: number) {
    if (saving.current) return;
    const gen = ++generation.current;
    setForm((v) => ({
      ...v,
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    }));
    setLocating(true);
    setMapError("");
    try {
      const [altitude, place] = await Promise.all([
        fetchElevation(latitude, longitude),
        fetchHeartRailsPlace(latitude, longitude),
      ]);
      if (gen === generation.current)
        setForm((v) => ({
          ...v,
          altitude: roundAltitude(Number(altitude)),
          localityJapaneseFull: place.placeName,
          localityJapaneseShort: place.shortPlaceName,
          localityRomaji_1: place.localityRomaji_1,
          localityRomaji_2: place.localityRomaji_2,
          localityRomaji_3: place.localityRomaji_3,
        }));
    } catch (e) {
      if (gen === generation.current)
        setMapError(`${errorText(e)} 採集地は手入力できます。`);
    } finally {
      if (gen === generation.current) setLocating(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setSaved(null);
    generation.current++;
    try {
      const event = await createEvent({
        ...form,
        latitude: roundCoordinate(form.latitude),
        longitude: roundCoordinate(form.longitude),
        altitude: roundAltitude(form.altitude),
      });
      setSaved(event);
      setForm({ ...empty(), collector: form.collector, method: form.method });
    } catch (e) {
      setError(errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">01 / COLLECTING EVENT</span>
          <h1>採集イベントを記録</h1>
          <p>採集した場所と日時を、標本の出発点に。</p>
        </div>
        <span className="badge">番号は保存時に自動発行</span>
      </div>
      <Notice
        error={error}
        message={
          saved
            ? `採集イベント #${saved.eventNumber} を保存しました。ラベル印刷へ進めます。`
            : ""
        }
      />
      {saved && <EventSummary event={saved} />}
      <div className="two-column">
        <section className="panel map-panel">
          <h2>採集地点</h2>
          <p className="muted">
            地図上を選択するか、右のフォームに直接入力してください。
          </p>
          <CollectionMap
            selectedPosition={
              form.latitude != null && form.longitude != null
                ? { latitude: form.latitude, longitude: form.longitude }
                : null
            }
            onSelect={selectPosition}
          />
          <small>地図：国土地理院 / 地名：HeartRails・国土交通省</small>
          {locating && <p role="status">地点情報を取得しています…</p>}
          <Notice error={mapError} />
        </section>
        <form className="panel stack" onSubmit={submit}>
          <fieldset disabled={busy} className="stack">
            <h2>採集情報</h2>
            <Field label="採集地（正式な日本語表記） *">
              <input
                required
                value={form.localityJapaneseFull}
                onChange={(e) => update("localityJapaneseFull", e.target.value)}
                placeholder="都道府県・市町村・地点名"
              />
            </Field>
            <Field label="ラベル用の短い地名">
              <input
                value={form.localityJapaneseShort}
                onChange={(e) =>
                  update("localityJapaneseShort", e.target.value)
                }
              />
            </Field>
            <fieldset className="stack">
              <legend>データラベル用の採集地（ローマ字・任意）</legend>
              <small>
                地図を選ぶと、国・都道府県／市区町村／細かい地名を3行に入力します。読み方や改行位置は修正できます。
              </small>
              {(
                [
                  "localityRomaji_1",
                  "localityRomaji_2",
                  "localityRomaji_3",
                ] as const
              ).map((key, index) => (
                <Field key={key} label={`ラベル${index + 1}行目（ローマ字）`}>
                  <input
                    name={key}
                    value={form[key] ?? ""}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </Field>
              ))}
            </fieldset>
            <div className="form-grid three">
              {(["latitude", "longitude", "altitude"] as const).map(
                (key, i) => (
                  <Field key={key} label={["緯度", "経度", "標高 / m"][i]}>
                    <input
                      type="number"
                      step={key === "altitude" ? "1" : "0.0001"}
                      min={i === 0 ? -90 : i === 1 ? -180 : undefined}
                      max={i === 0 ? 90 : i === 1 ? 180 : undefined}
                      value={form[key] ?? ""}
                      onChange={(e) =>
                        update(
                          key,
                          e.target.value === ""
                            ? undefined
                            : key === "altitude"
                              ? roundAltitude(Number(e.target.value))
                              : roundCoordinate(Number(e.target.value)),
                        )
                      }
                    />
                  </Field>
                ),
              )}
            </div>
            <div className="form-grid">
              <Field label="採集日 *">
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                />
              </Field>
              <Field label="採集者 *">
                <input
                  required
                  value={form.collector}
                  onChange={(e) => update("collector", e.target.value)}
                />
              </Field>
            </div>
            <Field label="採集方法">
              <input
                value={form.method}
                onChange={(e) => update("method", e.target.value)}
                placeholder="灯火・見つけ採り など"
              />
            </Field>
            <Field label="採集メモ">
              <textarea
                rows={3}
                value={form.memo}
                onChange={(e) => update("memo", e.target.value)}
              />
            </Field>
            <button className="primary" disabled={locating} type="submit">
              {busy ? "保存しています…" : "採集イベントを保存"}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
