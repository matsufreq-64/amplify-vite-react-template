import { useState, type FormEvent } from "react";
import { Field, Notice } from "./ui";
import {
  getDefaultCollector,
  setDefaultCollector,
} from "./registrationDefaults";

export default function Settings() {
  const [collector, setCollector] = useState(getDefaultCollector);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      setCollector(setDefaultCollector(collector));
      setMessage("採集者名の初期値を保存しました。");
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
          <h1>設定</h1>
          <p>採集イベント入力時の初期値を設定します。</p>
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
        <small>
          このブラウザのローカルストレージに保存します。採集イベントごとに名前を変更することもできます。
        </small>
        <button className="primary" type="submit">
          設定を保存
        </button>
        <Notice error={error} message={message} />
      </form>
    </div>
  );
}
