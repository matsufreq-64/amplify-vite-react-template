import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CollectingEvent, IdentificationInput, Taxon } from "./domain";
import { searchTaxa } from "./api/workflow";
import { useVoice } from "./useVoice";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function CollectingMethodField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <span>採集方法</span>
      <div className="method-choice">
        <select
          aria-label="採集方法の候補"
          value={value === "灯火" || value === "糖蜜" ? value : ""}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
        >
          <option value="">候補から選ぶ</option>
          <option value="灯火">灯火</option>
          <option value="糖蜜">糖蜜</option>
        </select>
        <input
          aria-label="採集方法を直接入力"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="選択または直接入力"
        />
      </div>
    </div>
  );
}
export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
    </>
  );
}

function coordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}°${value < 0 ? negative : positive}`;
}

export function EventSummary({
  event,
  actions,
}: {
  event: CollectingEvent;
  actions?: ReactNode;
}) {
  return (
    <section className="event-summary">
      <div>
        <span className="eyebrow">採集イベント</span>
        <strong className="number">
          #{String(event.eventNumber).padStart(8, "0")}
        </strong>
      </div>
      <h3>{event.localityJapaneseFull}</h3>
      <p className="event-summary-date">
        {event.date} <span className="dot">·</span> {event.collector}
      </p>
      <small>
        {[
          event.localityRomaji,
          event.method,
          event.altitude != null ? `${event.altitude} m` : "",
        ]
          .filter(Boolean)
          .join(" / ")}
      </small>
      {event.memo && <p>{event.memo}</p>}
      {(event.latitude != null || event.longitude != null) && (
        <small className="event-summary-coordinates">
          {[
            event.latitude != null ? coordinate(event.latitude, "N", "S") : "",
            event.longitude != null
              ? coordinate(event.longitude, "E", "W")
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        </small>
      )}
      {[
        event.localityRomaji_1,
        event.localityRomaji_2,
        event.localityRomaji_3,
      ].some(Boolean) && (
        <div className="stack">
          <small>データラベル用の採集地（ローマ字）</small>
          {[
            event.localityRomaji_1,
            event.localityRomaji_2,
            event.localityRomaji_3,
          ].map((line, index) => (
            <p key={index}>
              {index + 1}行目：{line || "（空欄）"}
            </p>
          ))}
        </div>
      )}
      {actions && <div className="event-summary-actions">{actions}</div>}
    </section>
  );
}
export function IdentificationFields({
  value,
  onChange,
  compact = false,
}: {
  value: IdentificationInput;
  onChange: (v: IdentificationInput) => void;
  compact?: boolean;
}) {
  const update = (key: keyof IdentificationInput, text: string) =>
    onChange({ ...value, [key]: text });
  const voice = useVoice((text) => update("japaneseName", text));
  const [candidates, setCandidates] = useState<Taxon[]>([]);
  const [error, setError] = useState("");
  const latest = useRef(0);
  useEffect(() => {
    const generation = ++latest.current;
    const timer = setTimeout(() => {
      if (!value.japaneseName.trim()) {
        setCandidates([]);
        setError("");
        return;
      }
      void searchTaxa(value.japaneseName.trim())
        .then((items) => {
          if (generation === latest.current) {
            setCandidates(items);
            setError("");
          }
        })
        .catch(() => {
          if (generation === latest.current)
            setError(
              "辞書候補を取得できませんでした。和名・学名は直接入力できます。",
            );
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      if (latest.current === generation) latest.current = generation + 1;
    };
  }, [value.japaneseName]);
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="和名">
          <input
            value={value.japaneseName}
            onChange={(e) => update("japaneseName", e.target.value)}
            placeholder="例：アオスジアゲハ"
          />
        </Field>
        <Field label="学名">
          <input
            value={value.scientificName}
            onChange={(e) => update("scientificName", e.target.value)}
            placeholder="例：Graphium sarpedon"
          />
        </Field>
      </div>
      <div>
        <button
          type="button"
          className="secondary"
          onClick={voice.start}
          disabled={voice.listening}
        >
          {voice.listening ? "● 音声を認識しています…" : "◎ 和名を音声入力"}
        </button>
        {!compact && (
          <small className="inline-hint">
            認識結果を確認・修正してから保存してください。
          </small>
        )}
      </div>
      <Notice error={voice.error || error} />
      {candidates.length > 0 && (
        <div className="suggestions">
          <small>名前辞書の候補 — 選ぶと和名・学名をコピーします</small>
          {candidates.map((t) => (
            <button
              className="secondary"
              type="button"
              key={t.id}
              onClick={() =>
                onChange({
                  ...value,
                  japaneseName: t.japaneseName ?? "",
                  scientificName: t.scientificName,
                })
              }
            >
              {t.japaneseName || "和名なし"} <i>{t.scientificName}</i>
            </button>
          ))}
        </div>
      )}
      <details
        open={compact ? undefined : true}
        className={compact ? "identification-extra" : "identification-expanded"}
      >
        <summary>同定日・同定者・根拠（任意）</summary>
        <div className="form-grid">
          <Field label="同定日（任意）">
            <input
              type="date"
              value={value.identifiedAt}
              onChange={(e) => update("identifiedAt", e.target.value)}
            />
          </Field>
          <Field label="同定者（任意）">
            <input
              value={value.identifiedBy}
              onChange={(e) => update("identifiedBy", e.target.value)}
            />
          </Field>
        </div>
        <Field label="同定の根拠・訂正理由（任意）">
          <textarea
            value={value.memo}
            onChange={(e) => update("memo", e.target.value)}
            rows={2}
          />
        </Field>
      </details>
    </div>
  );
}
