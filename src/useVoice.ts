import { useEffect, useRef, useState } from "react";
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((e: {
        results: {
          [index: number]: { [index: number]: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<Recognition | null>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(
    () => () => {
      if (active.current) {
        active.current.onend = null;
        active.current.onresult = null;
        active.current.onerror = null;
        active.current.abort();
      }
    },
    [],
  );
  function start() {
    setError("");
    const Constructor =
      (window as VoiceWindow).SpeechRecognition ??
      (window as VoiceWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setError(
        "このブラウザは音声入力に対応していません。和名を入力してください。",
      );
      return;
    }
    if (active.current) return;
    const r = new Constructor();
    active.current = r;
    r.lang = "ja-JP";
    r.interimResults = false;
    r.onresult = (e) => onResultRef.current(e.results[0][0].transcript);
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "マイクの使用が許可されていません。"
          : "音声を認識できませんでした。入力するか再試行してください。",
      );
      setListening(false);
      active.current = null;
    };
    r.onend = () => {
      setListening(false);
      active.current = null;
    };
    try {
      setListening(true);
      r.start();
    } catch {
      setListening(false);
      active.current = null;
      setError("音声入力を開始できませんでした。");
    }
  }
  return { listening, error, start };
}
