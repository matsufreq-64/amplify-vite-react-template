import { useEffect, useRef, useState } from "react";
import {
  prepareZXingModule,
  readBarcodes,
  writeBarcode,
  type ReadResult,
} from "zxing-wasm/full";
import wasmUrl from "zxing-wasm/full/zxing_full.wasm?url";
import { makeQr, numberValue, parseQr } from "./domain";
import { errorText } from "./errors";
import { Field, Notice } from "./ui";

const ready = prepareZXingModule({
  fireImmediately: true,
  overrides: {
    locateFile: (path, prefix) =>
      path.endsWith(".wasm") ? wasmUrl : prefix + path,
  },
});
const readerOptions = {
  formats: ["MicroQRCode", "QRCode"] as ("MicroQRCode" | "QRCode")[],
  tryHarder: true,
  maxNumberOfSymbols: 1,
};

export default function MicroQrTrial() {
  const [eventNumber, setEventNumber] = useState("2");
  const [specimenNumber, setSpecimenNumber] = useState("103");
  const [microUrl, setMicroUrl] = useState("");
  const [regularUrl, setRegularUrl] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [result, setResult] = useState<ReadResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const readingRef = useRef(false);
  const startingRef = useRef(false);
  const sessionRef = useRef(0);
  let value = "";
  try {
    value = makeQr(numberValue(eventNumber.trim()), numberValue(specimenNumber.trim()));
  } catch {
    // The form shows a validation message while the user edits a number.
  }

  useEffect(() => {
    if (!value) {
      setMicroUrl("");
      setRegularUrl("");
      setGenerationError("イベント番号と標本番号を1〜8桁で入力してください。");
      return;
    }
    let active = true;
    const urls: string[] = [];
    setMicroUrl("");
    setRegularUrl("");
    setGenerationError("");
    void (async () => {
      try {
        await ready;
        const [micro, regular] = await Promise.all([
          writeBarcode(value, {
            format: "MicroQRCode",
            options: "ecLevel=M",
            scale: 12,
            addQuietZones: true,
          }),
          writeBarcode(value, {
            format: "QRCode",
            options: "ecLevel=M",
            scale: 12,
            addQuietZones: true,
          }),
        ]);
        if (!micro.image || micro.error || !regular.image || regular.error)
          throw new Error(micro.error || regular.error || "QR画像を作成できませんでした。");
        if (!active) return;
        const microObjectUrl = URL.createObjectURL(micro.image);
        const regularObjectUrl = URL.createObjectURL(regular.image);
        urls.push(microObjectUrl, regularObjectUrl);
        setMicroUrl(microObjectUrl);
        setRegularUrl(regularObjectUrl);
      } catch (cause) {
        if (active) setGenerationError(errorText(cause));
      }
    })();
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [value]);

  function stopCamera() {
    sessionRef.current++;
    startingRef.current = false;
    setStarting(false);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }
  useEffect(() => () => {
    sessionRef.current++;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function showResult(found: ReadResult) {
    setResult(found);
    setScanError("");
    setScanMessage("読み取りに成功しました。");
  }
  async function scanFrame(session: number) {
    const video = videoRef.current;
    if (!video || !video.videoWidth || readingRef.current) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    readingRef.current = true;
    try {
      const found = (await readBarcodes(
        context.getImageData(0, 0, canvas.width, canvas.height),
        readerOptions,
      )).find((item) => item.isValid);
      if (found && session === sessionRef.current) {
        showResult(found);
        stopCamera();
      }
    } catch (cause) {
      if (session === sessionRef.current) {
        setScanError(errorText(cause));
        stopCamera();
      }
    } finally {
      readingRef.current = false;
    }
  }
  async function startCamera() {
    if (startingRef.current || scanning) return;
    startingRef.current = true;
    setStarting(true);
    setScanError("");
    setScanMessage("");
    setResult(null);
    const session = ++sessionRef.current;
    try {
      await ready;
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("このブラウザではカメラを使用できません。HTTPSまたはlocalhostで開いてください。");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("カメラ画面を開けませんでした。");
      video.srcObject = stream;
      await video.play();
      setScanning(true);
      timerRef.current = window.setInterval(() => void scanFrame(session), 250);
    } catch (cause) {
      if (session === sessionRef.current) {
        setScanError(errorText(cause));
        stopCamera();
      }
    } finally {
      startingRef.current = false;
      if (session === sessionRef.current) setStarting(false);
    }
  }
  async function scanPhoto(file: File | undefined) {
    if (!file) return;
    stopCamera();
    setScanError("");
    setScanMessage("");
    setResult(null);
    try {
      await ready;
      const found = (await readBarcodes(file, readerOptions)).find((item) => item.isValid);
      if (found) showResult(found);
      else setScanError("この写真からQRを検出できませんでした。近づいて、影や反射を避けて撮影してください。");
    } catch (cause) {
      setScanError(errorText(cause));
    }
  }
  let parsed: ReturnType<typeof parseQr> | null = null;
  if (result) {
    try {
      parsed = parseQr(result.text);
    } catch {
      // Other QR content can still be inspected in this trial screen.
    }
  }

  return (
    <div className="stack microqr-test">
      <div className="page-heading trial-screen">
        <div>
          <span className="eyebrow">EXPERIMENT / MICRO QR</span>
          <h1>マイクロQR読み取り試験</h1>
          <p>印刷サイズとスマホでの読み取りを比較します。AWSへの登録・変更は行いません。</p>
        </div>
      </div>
      <div className="two-column trial-screen">
        <section className="panel stack">
          <h2>試験用の番号とコード</h2>
          <div className="form-grid">
            <Field label="採集イベント番号">
              <input inputMode="numeric" value={eventNumber} onChange={(event) => setEventNumber(event.target.value)} />
            </Field>
            <Field label="標本番号">
              <input inputMode="numeric" value={specimenNumber} onChange={(event) => setSpecimenNumber(event.target.value)} />
            </Field>
          </div>
          <small>16桁の内容：{value || "入力待ち"}</small>
          <Notice error={generationError} />
          {microUrl && regularUrl && (
            <div className="trial-code-grid">
              <div><strong>マイクロQR</strong><img src={microUrl} alt="試験用マイクロQR" /><small>10 mm角相当</small></div>
              <div><strong>現在の通常QR</strong><img src={regularUrl} alt="比較用の通常QR" /><small>10 mm角相当</small></div>
            </div>
          )}
          <button className="secondary" type="button" disabled={!microUrl || !regularUrl} onClick={() => window.print()}>
            10・12・15 mmの比較シートを印刷
          </button>
          <small>印刷倍率100%で出力してください。画面上の表示サイズは端末によって実寸と異なります。</small>
        </section>
        <section className="panel stack">
          <h2>スマホで読み取る</h2>
          <p className="muted">印刷したコードを背面カメラに写してください。映像は左右反転しません。</p>
          <video ref={videoRef} className="trial-video" playsInline muted autoPlay />
          <div className="toolbar">
            <button type="button" className="primary" disabled={scanning || starting} onClick={() => void startCamera()}>{starting ? "カメラを準備中…" : "背面カメラを開始"}</button>
            <button type="button" className="secondary" disabled={!scanning && !starting} onClick={stopCamera}>停止</button>
          </div>
          <Field label="写真から試す（カメラを使えない場合）">
            <input type="file" accept="image/*" capture="environment" onChange={(event) => void scanPhoto(event.target.files?.[0])} />
          </Field>
          <Notice error={scanError} message={scanMessage} />
          {result && (
            <div className="registration-event" role="status">
              <strong>読み取り結果：{result.format === "MicroQRCode" ? "マイクロQR" : "通常QR"}</strong>
              <p>内容：{result.text}</p>
              {parsed && <p>採集イベント #{parsed.eventNumber} / 標本 #{parsed.specimenNumber}</p>}
              {!parsed && <small>このアプリの採集イベント・標本番号形式ではありません。</small>}
            </div>
          )}
        </section>
      </div>
      <section className="trial-print-sheet" aria-label="QR印刷比較シート">
        <h1>マイクロQR 読み取り試験</h1>
        <p>内容：{value} / 印刷倍率100%</p>
        {[10, 12, 15].map((size) => (
          <div className="trial-print-row" key={size}>
            <span>{size} mm</span>
            {microUrl && <div><img src={microUrl} alt={`マイクロQR ${size} mm`} style={{ width: `${size}mm`, height: `${size}mm` }} /><small>マイクロQR</small></div>}
            {regularUrl && <div><img src={regularUrl} alt={`通常QR ${size} mm`} style={{ width: `${size}mm`, height: `${size}mm` }} /><small>通常QR</small></div>}
          </div>
        ))}
      </section>
    </div>
  );
}
