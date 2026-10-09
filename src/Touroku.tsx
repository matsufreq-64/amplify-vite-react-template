import { errorText } from "./errors";
import { useId, useRef, useState, type FormEvent } from "react";
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
  type SpecimenDetail,
  type IdentificationInput,
} from "./domain";
import { nextIdentification } from "./registrationDefaults";
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
  const [carryName, setCarryName] = useState(true);
  const [lastSaved, setLastSaved] = useState<IdentificationInput | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const lookupFormId = useId();
  const registerFormId = useId();
  const specimenInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const saving = useRef(false);
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
    if (
      !detail ||
      saving.current ||
      complete ||
      (reidentify ? !detail.specimen : !!detail.specimen || !detail.issued)
    )
      return;
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
        setLastSaved({
          ...identification,
          japaneseName: identification.japaneseName.trim(),
          scientificName: identification.scientificName.trim(),
        });
        setRegisteredCount((count) => count + 1);
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
  const canSave =
    !!detail &&
    (reidentify ? !!detail.specimen : !detail.specimen && detail.issued);
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
          <h1>{reidentify ? "同定履歴を追加" : "標本を登録"}</h1>
          <p>
            {reidentify
              ? "標本を確認して、新しい同定を記録します。"
              : "① QR・番号で確認 → ② 和名などを入力 → ③ 登録"}
          </p>
        </div>
        {!reidentify && (
          <span className="badge">今回 {registeredCount} 件登録</span>
        )}
      </div>
      <div className="registration-grid">
        <section className="panel stack">
          <h2>1. QR・番号で確認</h2>
          <button
            type="button"
            className="scan-button"
            disabled={busy}
            onClick={() => {
              reset();
              setCamera((v) => !v);
            }}
          >
            {camera ? "カメラを閉じる" : "▣ QRを読み取る"}
          </button>
          {camera && <QrScanner onScan={scan} />}
          <form
            id={lookupFormId}
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
                  label={`採集イベント番号${reidentify ? "（任意）" : ""}`}
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
          </form>
          {detail ? (
            <div className="registration-event">
              <span className="badge">
                {detail.specimen
                  ? "登録済み"
                  : detail.issued
                    ? "確認済み・登録できます"
                    : "未発行"}
              </span>
              <p>
                {detail.event.localityJapaneseFull}
                <br />
                {detail.event.date} / {detail.event.collector}
              </p>
              <details>
                <summary>採集情報の詳細</summary>
                <EventSummary event={detail.event} />
              </details>
            </div>
          ) : (
            <small>
              番号を確認すると、採集地・採集日がここに表示されます。
            </small>
          )}
        </section>
        <form id={registerFormId} className="panel stack" onSubmit={submit}>
          <h2>2. {reidentify ? "新しい同定" : "和名・標本情報"}</h2>
          <fieldset
            className="stack"
            disabled={busy || complete || (!!detail && !canSave)}
          >
            <IdentificationFields
              value={identification}
              onChange={setIdentification}
              compact={!reidentify}
            />
            {!reidentify && (
              <>
                <div className="registration-options">
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
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      setIdentification({ ...emptyIdentification })
                    }
                  >
                    名前をクリア
                  </button>
                </div>
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
        </form>
      </div>
      <section className="registration-dock stack" aria-label="確認と登録">
        <Notice error={error} message={message} />
        {complete ? (
          <div className="stack registration-actions">
            {!reidentify && (
              <button
                type="button"
                className="primary"
                onClick={() => nextSpecimen(true)}
              >
                次のQRを読み取る
              </button>
            )}
            <button
              type="button"
              className={reidentify ? "primary" : "secondary"}
              onClick={() => nextSpecimen(false)}
            >
              次の標本番号を入力
            </button>
          </div>
        ) : (
          <>
            <small>
              {!detail
                ? "先にQR・番号を確認してください。和名は先に入力できます。"
                : !canSave
                  ? "この標本は登録できません。確認結果をご覧ください。"
                  : reidentify
                    ? "以前の履歴を残して同定を追加します。"
                    : "和名・学名が空欄なら未同定として登録します。"}
            </small>
            <div className="registration-button-pair">
              <button
                type="submit"
                form={lookupFormId}
                className="secondary"
                disabled={busy}
              >
                採集情報・登録状態を確認
              </button>
              <button
                form={registerFormId}
                type="submit"
                className="primary"
                disabled={
                  busy ||
                  !canSave ||
                  (reidentify &&
                    !identification.japaneseName.trim() &&
                    !identification.scientificName.trim())
                }
              >
                {busy
                  ? "処理しています…"
                  : reidentify
                    ? "同定を追加する"
                    : "3. 確認して標本を登録"}
              </button>
            </div>
          </>
        )}
      </section>
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
    </div>
  );
}
