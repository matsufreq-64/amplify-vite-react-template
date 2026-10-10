import { errorText } from "./errors";
import { useEffect, useRef, useState, type FormEvent } from "react";
import MicroQrScanner from "./components/MicroQrScanner";
import {
  addIdentification,
  findEvent,
  lookupSpecimen,
  registerSpecimen,
} from "./api/workflow";
import {
  numberValue,
  parseQr,
  type CollectingEvent,
  type SpecimenDetail,
  type IdentificationInput,
} from "./domain";
import {
  initialIdentification,
  nextIdentification,
} from "./registrationDefaults";
import { EventSummary, Field, IdentificationFields, Notice } from "./ui";
export default function Touroku({
  reidentify = false,
}: {
  reidentify?: boolean;
}) {
  const [eventNumber, setEventNumber] = useState("");
  const [specimenNumber, setSpecimenNumber] = useState("");
  const [detail, setDetail] = useState<SpecimenDetail | null>(null);
  const [previewEvent, setPreviewEvent] = useState<CollectingEvent | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [identification, setIdentification] = useState(initialIdentification);
  const [sex, setSex] = useState("unexamined");
  const [memo, setMemo] = useState("");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [carryName, setCarryName] = useState(true);
  const [lastSaved, setLastSaved] = useState<IdentificationInput | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [recentRegistrations, setRecentRegistrations] = useState<{
    id: string;
    eventNumber: number;
    specimenNumber: number;
    locality: string;
    date: string;
    japaneseName: string;
    scientificName: string;
    registeredAt: string;
  }[]>([]);
  const specimenInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const saving = useRef(false);
  useEffect(() => {
    const value = eventNumber.trim();
    if (!/^\d{1,8}$/.test(value) || Number(value) < 1) {
      setPreviewEvent(null);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }
    if (detail?.event.eventNumber === Number(value)) {
      setPreviewEvent(detail.event);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }
    let active = true;
    setPreviewLoading(true);
    setPreviewError("");
    const timer = window.setTimeout(() => {
      void findEvent(Number(value))
        .then((event) => {
          if (active) setPreviewEvent(event);
        })
        .catch((cause) => {
          if (active) {
            setPreviewEvent(null);
            setPreviewError(errorText(cause));
          }
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [eventNumber, detail]);
  const reset = (next = false) => {
    generation.current++;
    setDetail(null);
    setError("");
    setMessage("");
    setComplete(false);
    if (next || complete || reidentify) {
      setIdentification(
        nextIdentification(lastSaved, !reidentify && carryName),
      );
      setSex("unexamined");
      setMemo("");
    }
  };
  async function search(sp: string, ce: string) {
    const gen = ++generation.current;
    setDetail(null);
    setError("");
    setMessage("");
    setComplete(false);
    setBusy(true);
    try {
      const result = await lookupSpecimen(
        numberValue(sp),
        ce ? numberValue(ce) : undefined,
      );
      if (gen !== generation.current) return;
      setDetail(result);
      setEventNumber(String(result.event.eventNumber));
      if (reidentify && !result.specimen)
        setError(
          "この標本はまだ登録されていません。先に標本登録を行ってください。",
        );
      if (!reidentify && result.specimen)
        setMessage(
          "登録済みの標本です。同じラベルを別の標本に使用していないか現物を確認してください。",
        );
      if (!result.specimen && !result.issued)
        setError(
          "この番号の発行台帳がありません。ラベル印刷画面で発行した番号を使用してください。",
        );
    } catch (e) {
      if (gen === generation.current) setError(errorText(e));
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }
  function scan(value: string) {
    setCamera(false);
    reset();
    try {
      const parsed = parseQr(value);
      setEventNumber(String(parsed.eventNumber));
      setSpecimenNumber(String(parsed.specimenNumber));
      void search(String(parsed.specimenNumber), String(parsed.eventNumber));
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving.current || complete) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const currentDetail = detail ?? await lookupSpecimen(
        numberValue(specimenNumber),
        eventNumber ? numberValue(eventNumber) : undefined,
      );
      if (!detail) {
        setDetail(currentDetail);
        setEventNumber(String(currentDetail.event.eventNumber));
      }
      if (reidentify && !currentDetail.specimen)
        throw new Error("この標本はまだ登録されていません。先に標本登録を行ってください。");
      if (!reidentify && currentDetail.specimen)
        throw new Error("登録済みの標本です。同じラベルを別の標本に使用していないか現物を確認してください。");
      if (!reidentify && !currentDetail.issued)
        throw new Error("この番号の発行台帳がありません。ラベル印刷画面で発行した番号を使用してください。");
      if (reidentify && currentDetail.specimen) {
        const row = await addIdentification(currentDetail.specimen.id, identification);
        setDetail({ ...currentDetail, history: [row, ...currentDetail.history] });
        setMessage(
          "新しい同定を追加しました。以前の同定履歴は保持されています。",
        );
      } else {
        const specimen = await registerSpecimen({
          eventNumber: currentDetail.event.eventNumber,
          specimenNumber: numberValue(specimenNumber),
          sex,
          memo,
          identification,
        });
        setDetail({ ...currentDetail, specimen });
        setLastSaved({
          ...identification,
          japaneseName: identification.japaneseName.trim(),
          scientificName: identification.scientificName.trim(),
        });
        setRegisteredCount((count) => count + 1);
        setRecentRegistrations((current) => [{
          id: specimen.id,
          eventNumber: currentDetail.event.eventNumber,
          specimenNumber: specimen.specimenNumber,
          locality: currentDetail.event.localityJapaneseFull,
          date: currentDetail.event.date,
          japaneseName: identification.japaneseName.trim(),
          scientificName: identification.scientificName.trim(),
          registeredAt: new Date().toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }, ...current]);
        setMessage(
          `${identification.japaneseName.trim() || identification.scientificName.trim() ? "同定付きで" : "未同定で"}登録しました。`,
        );
      }
      setComplete(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const displayEvent = detail?.event ?? previewEvent;
  function nextSpecimen(useCamera: boolean) {
    reset(true);
    setSpecimenNumber("");
    setCamera(useCamera);
    if (!useCamera) specimenInput.current?.focus();
  }
  return (
    <div className="stack registration-page">
      <div className="page-heading">
        <div>
          {!reidentify && (
            <span className="eyebrow">03 / SPECIMEN REGISTRATION</span>
          )}
          <h1>{reidentify ? "同定履歴を追加" : "標本を登録"}</h1>
          <p>
            {reidentify
              ? "標本を確認して、新しい同定を記録します。"
              : "① 採集イベント・標本番号を入力 → ② 標本情報を入力 → ③ 登録"}
          </p>
        </div>
        {!reidentify && (
          <span className="badge">今回 {registeredCount} 件登録</span>
        )}
      </div>
      <div className="registration-grid">
        <section className="panel stack">
          <h2>1. 採集イベントを検索</h2>
          <button
            type="button"
            className="scan-button"
            disabled={busy}
            onClick={() => {
              reset();
              setCamera((v) => !v);
            }}
          >
            {camera ? "カメラを閉じる" : "▣ マイクロQRを読み取る"}
          </button>
          {camera && <MicroQrScanner onScan={scan} />}
          <div>
            <fieldset disabled={busy} className="stack">
              <div className="form-grid">
                <Field
                  label={`採集イベント番号${reidentify ? "（任意）" : ""}`}
                >
                  <input
                    inputMode="numeric"
                    required={!reidentify}
                    value={eventNumber}
                    onChange={(e) => {
                      reset();
                      setPreviewEvent(null);
                      setPreviewError("");
                      setEventNumber(e.target.value);
                    }}
                    placeholder="例：2"
                  />
                </Field>
                <Field label="標本番号">
                  <input
                    ref={specimenInput}
                    inputMode="numeric"
                    required
                    value={specimenNumber}
                    onChange={(e) => {
                      reset();
                      setSpecimenNumber(e.target.value);
                    }}
                    placeholder="例：103"
                  />
                </Field>
              </div>
            </fieldset>
          </div>
          {displayEvent ? (
            <div className="registration-event">
              {detail && (
                <span className="badge">
                  {detail.specimen
                    ? "登録済み"
                    : detail.issued
                      ? "確認済み・登録できます"
                      : "未発行"}
                </span>
              )}
              <p>
                {displayEvent.localityJapaneseFull}
                <br />
                {displayEvent.date} / {displayEvent.collector}
                <br />
                採集方法：{displayEvent.method || "未入力"}
              </p>
              <details>
                <summary>採集情報の詳細</summary>
                <EventSummary event={displayEvent} />
              </details>
            </div>
          ) : (
            <small role="status">
              {previewLoading
                ? "採集イベントを検索しています…"
                : previewError || "採集イベント番号を入力すると、採集地・採集日・採集方法がここに表示されます。"}
            </small>
          )}
        </section>
        <form className="panel stack" onSubmit={submit}>
          <h2>2. {reidentify ? "新しい同定" : "標本情報入力"}</h2>
          <fieldset
            className="stack"
            disabled={busy || complete}
          >
            <IdentificationFields
              value={identification}
              onChange={setIdentification}
              compact={!reidentify}
              beforeMetadata={!reidentify && (
                <details className="registration-sex">
                  <summary>性別{sex !== "unexamined" ? "・選択あり" : "（任意）"}</summary>
                  <Field label="性別">
                    <select value={sex} onChange={(e) => setSex(e.target.value)}>
                      <option value="unexamined">未判定</option>
                      <option value="male">♂ オス</option>
                      <option value="female">♀ メス</option>
                      <option value="unknown">不明</option>
                    </select>
                  </Field>
                </details>
              )}
            />
            {!reidentify && (
              <>
                <details>
                  <summary>標本メモ（任意）{memo ? "・入力あり" : ""}</summary>
                  <Field label="標本のメモ">
                    <textarea
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      rows={2}
                    />
                  </Field>
                </details>
              </>
            )}
          </fieldset>
          {!reidentify && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={carryName}
                disabled={busy}
                onChange={(e) => setCarryName(e.target.checked)}
              />
              次の標本に和名・学名を引き継ぐ
            </label>
          )}
          <Notice error={error} message={message} />
          {complete ? (
            <div className="stack registration-actions">
              {!reidentify && <button type="button" className="primary" onClick={() => nextSpecimen(true)}>次のマイクロQRを読み取る</button>}
              <button type="button" className={reidentify ? "primary" : "secondary"} onClick={() => nextSpecimen(false)}>次の標本番号を入力</button>
            </div>
          ) : (
            <>
              <small>登録時に番号と登録状態を確認します。和名・学名が空欄なら未同定として登録します。</small>
              <button type="submit" className="primary registration-submit" disabled={busy || !specimenNumber.trim() || (!reidentify && !eventNumber.trim()) || (reidentify && !identification.japaneseName.trim() && !identification.scientificName.trim())}>
                {busy ? "処理しています…" : reidentify ? "同定を追加する" : "登録"}
              </button>
            </>
          )}
        </form>
      </div>
      {detail?.specimen && (
        <details
          className="panel registration-history"
          open={reidentify ? true : undefined}
        >
          <summary>同定履歴（{detail.history.length}件）</summary>
          {!detail.history.length && (
            <p>
              {complete &&
              !reidentify &&
              (identification.japaneseName || identification.scientificName)
                ? "初回同定を保存しました。履歴は再検索すると表示されます。"
                : "同定履歴はありません。"}
            </p>
          )}
          {detail.history.map((h, i) => (
            <article key={h.id} className="history">
              <div>
                <strong>{h.japaneseName || "和名なし"}</strong>
                {i === 0 && <span className="badge">現在の同定</span>}
              </div>
              <i>{h.scientificName}</i>
              <small>
                {h.identifiedAt || "同定日未入力"} /{" "}
                {h.identifiedBy || "同定者未入力"}
              </small>
              {h.memo && <p>{h.memo}</p>}
            </article>
          ))}
        </details>
      )}
      {!reidentify && (
        <section className="panel stack registration-recent" aria-label="この画面で登録した標本">
          <h2>この画面で登録した標本（{recentRegistrations.length}件）</h2>
          {recentRegistrations.length === 0 ? (
            <p className="muted">登録すると、ここに新しい順で表示します。</p>
          ) : (
            <div className="event-results-scroll">
              <table className="event-results-table registration-recent-table">
                <thead><tr><th scope="col">標本番号</th><th scope="col">イベント番号</th><th scope="col">和名・学名</th><th scope="col">採集地</th><th scope="col">採集日</th><th scope="col">登録時刻 ↓</th></tr></thead>
                <tbody>{recentRegistrations.map((entry) => <tr key={entry.id}>
                  <td>SP {String(entry.specimenNumber).padStart(8, "0")}</td>
                  <td>{String(entry.eventNumber).padStart(8, "0")}</td>
                  <td><strong>{entry.japaneseName || entry.scientificName || "未同定"}</strong>{entry.japaneseName && entry.scientificName && <small className="registration-recent-scientific"><i>{entry.scientificName}</i></small>}</td>
                  <td>{entry.locality}</td>
                  <td>{entry.date.replace(/-/g, "/")}</td>
                  <td>{entry.registeredAt}</td>
                </tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
