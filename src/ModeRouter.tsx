import { lazy, Suspense, useState } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import App from "./App";
const Touroku = lazy(() => import("./Touroku"));
const Labels = lazy(() => import("./Labels"));
const Taxa = lazy(() => import("./Taxa"));
const Browse = lazy(() => import("./Browse"));
const modes = [
  {
    id: "collection",
    label: "採集イベント",
    icon: "01",
    description: "場所・日時・採集者を記録",
  },
  {
    id: "labels",
    label: "ラベル印刷",
    icon: "02",
    description: "番号を確保してExcelを作成",
  },
  {
    id: "specimen",
    label: "標本登録",
    icon: "03",
    description: "QRを読み取り、実物を登録",
  },
  {
    id: "identification",
    label: "再同定",
    icon: "04",
    description: "同定履歴を追加",
  },
  {
    id: "browse",
    label: "データ閲覧",
    icon: "▤",
    description: "登録データと履歴を確認",
  },
  {
    id: "taxa",
    label: "名前辞書",
    icon: "Aa",
    description: "和名・学名の入力を補助",
  },
] as const;
type Mode = (typeof modes)[number]["id"];
export default function ModeRouter() {
  const [mode, setMode] = useState<Mode>("collection");
  const { signOut, user } = useAuthenticator();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode("collection");
          }}
        >
          <span className="brand-mark">✳</span>
          <span>
            採集標本データベース<small>FIELD NOTES & SPECIMENS</small>
          </span>
        </a>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="メインメニュー">
          {modes.map((m) => (
            <button
              key={m.id}
              aria-current={mode === m.id ? "page" : undefined}
              onClick={() => setMode(m.id)}
              className={mode === m.id ? "active" : ""}
            >
              <span className="nav-icon">{m.icon}</span>
              <span>
                {m.label}
                <small>{m.description}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> 個人コレクション
          <small>採集の記録を、標本の記憶へ。</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            コレクション <span className="dot">/</span>{" "}
            {modes.find((m) => m.id === mode)?.label}
          </span>
          <div>
            <span className="user-name">
              {user?.signInDetails?.loginId || "ログイン中"}
            </span>
            <button className="quiet" onClick={signOut}>
              ログアウト
            </button>
          </div>
        </header>
        <main className="main-content">
          <Suspense
            fallback={
              <div className="panel" role="status">
                画面を読み込んでいます…
              </div>
            }
          >
            {mode === "collection" && <App />}
            {mode === "specimen" && <Touroku key="register" />}
            {mode === "identification" && <Touroku key="identify" reidentify />}
            {mode === "labels" && <Labels />}
            {mode === "taxa" && <Taxa />}
            {mode === "browse" && <Browse />}
          </Suspense>
        </main>
        <footer>
          COLLECTION ARCHIVE <span>採集 → ラベル → 標本 → 同定</span>
        </footer>
      </div>
    </div>
  );
}
