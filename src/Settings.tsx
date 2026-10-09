import { useState, type FormEvent } from "react";
import { Field, Notice } from "./ui";
import {
  getDefaultCollector,
  getDefaultIdentifier,
  getUseCurrentLocation,
  setDefaultCollector,
  setDefaultIdentifier,
  setUseCurrentLocation,
} from "./registrationDefaults";

export default function Settings() {
  const [collector, setCollector] = useState(getDefaultCollector);
  const [identifier, setIdentifier] = useState(getDefaultIdentifier);
  const [useCurrentLocation, setCurrentLocation] = useState(
    getUseCurrentLocation,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      if (!collector.trim() || !identifier.trim())
        throw new Error("採集者名と同定者名を入力してください。");
      setCollector(setDefaultCollector(collector));
      setIdentifier(setDefaultIdentifier(identifier));
      setCurrentLocation(setUseCurrentLocation(useCurrentLocation));
      setMessage("設定を保存しました。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "保存できませんでした。",
      );
    }
  }
  return (
    <div className="stack narrow">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>設定</h1>
          <p>採集イベントと同定の入力時に使う初期値を設定します。</p>
        </div>
      </div>
      <form className="panel stack" onSubmit={save}>
        <h2>採集者名の初期値</h2>
        <Field label="採集者名">
          <input
            required
            value={collector}
            onChange={(event) => {
              setCollector(event.target.value);
              setMessage("");
            }}
          />
        </Field>
        <h2>同定者名の初期値</h2>
        <Field label="同定者名">
          <input
            required
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setMessage("");
            }}
          />
        </Field>
        <h2>地図の初期位置</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={useCurrentLocation}
            onChange={(event) => {
              setCurrentLocation(event.target.checked);
              setMessage("");
            }}
          />
          現在位置を使って地図の中心を決める
        </label>
        <small>
          オンの場合、採集イベント画面を開いたときに位置情報の許可を求めます。現在位置は地図の中心に使うだけで、採集地点としては保存しません。
        </small>
        <small>
          このブラウザのローカルストレージに保存します。各登録時に名前を変更することもできます。
        </small>
        <button className="primary" type="submit">
          設定を保存
        </button>
        <Notice error={error} message={message} />
      </form>
    </div>
  );
}
