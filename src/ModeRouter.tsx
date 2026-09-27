import { useState } from "react";
import App from "./App";

type Mode =
  | "collection"
  | "specimen"
  | "identification"
  | "dataLabel"
  | "identificationLabel";

export default function ModeRouter() {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode === null) {
    return (
      <main>
        <h1>モードを選択</h1>

        <button type="button" onClick={() => setMode("collection")}>
          採集記録
        </button>

        <button type="button" onClick={() => setMode("specimen")}>
          標本データベース登録
        </button>

        <button type="button" onClick={() => setMode("identification")}>
          同定結果登録
        </button>

        <button type="button" onClick={() => setMode("dataLabel")}>
          データラベル印刷
        </button>

        <button
          type="button"
          onClick={() => setMode("identificationLabel")}
        >
          同定ラベル印刷
        </button>
      </main>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setMode(null)}>
        ← モード選択に戻る
      </button>

      {mode === "collection" && <App />}

      {mode === "specimen" && (
        <main>
          <h1>標本データベース登録</h1>
          <p>この画面はこれから作成します。</p>
        </main>
      )}

      {mode === "identification" && (
        <main>
          <h1>同定結果登録</h1>
          <p>この画面はこれから作成します。</p>
        </main>
      )}

      {mode === "dataLabel" && (
        <main>
          <h1>データラベル印刷</h1>
          <p>この画面はこれから作成します。</p>
        </main>
      )}

      {mode === "identificationLabel" && (
        <main>
          <h1>同定ラベル印刷</h1>
          <p>この画面はこれから作成します。</p>
        </main>
      )}
    </>
  );
}