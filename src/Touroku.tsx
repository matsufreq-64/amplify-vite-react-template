import { errorText } from "./errors";
import { useRef, useState, type FormEvent } from "react";
import QrScanner from "./components/QrScanner";
import {
  addIdentification,
  lookupSpecimen,
  registerSpecimen,
} from "./api/workflow";
import {
  emptyIdentification,
  numberValue,
  parseQr,
  specimenLabel,
  type SpecimenDetail,
} from "./domain";
import { EventSummary, Field, IdentificationFields, Notice } from "./ui";
export default function Touroku({
  reidentify = false,
}: {
  reidentify?: boolean;
}) {
  const [eventNumber, setEventNumber] = useState("");
  const [specimenNumber, setSpecimenNumber] = useState("");
  const [detail, setDetail] = useState<SpecimenDetail | null>(null);
  const [identification, setIdentification] = useState({
    ...emptyIdentification,
  });
  const [sex, setSex] = useState("unexamined");
  const [memo, setMemo] = useState("");
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const generation = useRef(0);
  const saving = useRef(false);
  const reset = () => {
    generation.current++;
    setDetail(null);
    setError("");
    setMessage("");
    setComplete(false);
    setIdentification({ ...emptyIdentification });
    setSex("unexamined");
    setMemo("");
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
    if (!detail || saving.current || complete) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      if (reidentify && detail.specimen) {
        const row = await addIdentification(detail.specimen.id, identification);
        setDetail({ ...detail, history: [row, ...detail.history] });
        setMessage(
          "新しい同定を追加しました。以前の同定履歴は保持されています。",
        );
      } else {
        const specimen = await registerSpecimen({
          eventNumber: detail.event.eventNumber,
          specimenNumber: numberValue(specimenNumber),
          sex,
          memo,
          identification,
        });
        setDetail({ ...detail, specimen });
        setMessage(
          `${specimenLabel(specimen.specimenNumber)} を${identification.japaneseName.trim() || identification.scientificName.trim() ? "同定付きで" : "未同定で"}登録しました。`,
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
  return (
    <div className="stack narrow">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {reidentify ? "04 / IDENTIFICATION" : "03 / SPECIMEN"}
          </span>
          <h1>{reidentify ? "同定履歴を追加" : "標本を登録"}</h1>
          <p>
            {reidentify
              ? "過去の記録を残しながら、新しい同定を記録します。"
              : "ラベルを付けた実物を確認してから登録してください。"}
          </p>
        </div>
      </div>
      <section className="panel stack">
        <div className="section-heading">
          <h2>1. ラベルを読み取る</h2>
          <span className="badge">QR / 番号入力</span>
        </div>
        <button
          type="button"
          className="scan-button"
          disabled={busy}
          onClick={() => {
            reset();
            setCamera((v) => !v);
          }}
        >
          {camera ? "カメラを閉じる" : "▣ カメラでQRを読み取る"}
        </button>
        {camera && <QrScanner onScan={scan} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCamera(false);
            reset();
            void search(specimenNumber, eventNumber);
          }}
        >
          <fieldset disabled={busy} className="stack">
            <div className="form-grid">
              <Field
                label={`採集イベント番号${reidentify ? "（QRなしの検索時は任意）" : ""}`}
              >
                <input
                  inputMode="numeric"
                  required={!reidentify}
                  value={eventNumber}
                  onChange={(e) => {
                    reset();
                    setEventNumber(e.target.value);
                  }}
                  placeholder="例：2"
                />
              </Field>
              <Field label="標本番号">
                <input
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
            <button type="submit" className="secondary">
              {busy ? "処理しています…" : "採集情報・登録状態を確認"}
            </button>
          </fieldset>
        </form>
      </section>
      <Notice error={error} message={message} />
      {detail && (
        <>
          <EventSummary event={detail.event} />
          <div className="specimen-strip">
            <span>標本番号</span>
            <strong>{specimenLabel(numberValue(specimenNumber))}</strong>
            <span className="badge">
              {detail.specimen ? "登録済み" : "未登録"}
            </span>
          </div>
          {detail.specimen && (
            <section className="panel stack">
              <h2>
                同定履歴 <span className="count">{detail.history.length}</span>
              </h2>
              <p className="muted">
                最新の追加を現在の同定として表示します。同定日順ではありません。
              </p>
              {!detail.history.length && (
                <p>
                  {complete &&
                  !reidentify &&
                  (identification.japaneseName || identification.scientificName)
                    ? "初回同定を保存しました。履歴は再検索すると表示されます。"
                    : "未同定 — 同定履歴はありません。"}
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
            </section>
          )}
          {!complete &&
            ((reidentify && detail.specimen) ||
              (!reidentify && !detail.specimen && detail.issued)) && (
              <form className="panel stack" onSubmit={submit}>
                <fieldset className="stack" disabled={busy}>
                  <h2>2. {reidentify ? "新しい同定" : "標本の情報"}</h2>
                  {!reidentify && (
                    <>
                      <Field label="性別">
                        <select
                          value={sex}
                          onChange={(e) => setSex(e.target.value)}
                        >
                          <option value="unexamined">未判定</option>
                          <option value="male">♂ オス</option>
                          <option value="female">♀ メス</option>
                          <option value="unknown">不明</option>
                        </select>
                      </Field>
                      <Field label="標本のメモ">
                        <textarea
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                          rows={3}
                        />
                      </Field>
                      <hr />
                      <h2>
                        初回同定 <span className="badge">任意</span>
                      </h2>
                      <p className="muted">
                        和名・学名が空欄なら、未同定として保存します。
                      </p>
                    </>
                  )}
                  <IdentificationFields
                    value={identification}
                    onChange={setIdentification}
                  />
                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      reidentify &&
                      !identification.japaneseName.trim() &&
                      !identification.scientificName.trim()
                    }
                  >
                    {busy
                      ? "保存しています…"
                      : reidentify
                        ? "同定を追加する"
                        : "確認して標本を登録する"}
                  </button>
                </fieldset>
              </form>
            )}
          {complete && (
            <button
              className="primary"
              onClick={() => {
                reset();
                setEventNumber("");
                setSpecimenNumber("");
              }}
            >
              {reidentify ? "次の標本を同定する" : "次の標本を登録する"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
