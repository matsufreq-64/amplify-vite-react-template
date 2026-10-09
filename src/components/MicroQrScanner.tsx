import { useEffect, useRef, useState } from "react";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/full";
import wasmUrl from "zxing-wasm/full/zxing_full.wasm?url";
import { errorText } from "../errors";

const ready = prepareZXingModule({
  fireImmediately: true,
  overrides: {
    locateFile: (path, prefix) =>
      path.endsWith(".wasm") ? wasmUrl : prefix + path,
  },
});
const readerOptions = {
  formats: ["MicroQRCode"] as ["MicroQRCode"],
  tryHarder: true,
  maxNumberOfSymbols: 1,
};

export default function MicroQrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const video = videoRef.current;
    let active = true;
    let accepted = false;
    let reading = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const canvas = document.createElement("canvas");

    async function scanFrame() {
      if (!active || accepted || reading || !video?.videoWidth) return;
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      reading = true;
      try {
        const found = (await readBarcodes(
          context.getImageData(0, 0, canvas.width, canvas.height),
          readerOptions,
        )).find((result) => result.isValid);
        if (active && !accepted && found) {
          accepted = true;
          onScanRef.current(found.text);
        }
      } catch (cause) {
        if (active) setError(errorText(cause));
      } finally {
        reading = false;
      }
    }

    void (async () => {
      try {
        await ready;
        if (!active) return;
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("このブラウザではカメラを使用できません。HTTPSまたはlocalhostで開いてください。");
        const opened = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (!active) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = opened;
        if (!video) throw new Error("カメラ画面を開けませんでした。");
        video.srcObject = opened;
        await video.play();
        if (active) timer = window.setInterval(() => void scanFrame(), 250);
      } catch (cause) {
        if (active) setError(errorText(cause));
      } finally {
        if (active) setStarting(false);
      }
    })();

    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    };
  }, []);

  async function scanPhoto(file?: File) {
    if (!file) return;
    setError("");
    try {
      await ready;
      const found = (await readBarcodes(file, readerOptions)).find((result) => result.isValid);
      if (found) onScanRef.current(found.text);
      else setError("写真からマイクロQRを検出できませんでした。");
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  return (
    <div className="qr-scanner stack">
      <video ref={videoRef} className="trial-video" playsInline muted autoPlay />
      {starting && <small>背面カメラを準備しています…</small>}
      {error && <p role="alert" className="notice error">{error}</p>}
      <small>マイクロQRのみ読み取ります。カメラ映像は左右反転しません。</small>
      <label>
        写真から読み取る
        <input type="file" accept="image/*" capture="environment" onChange={(event) => void scanPhoto(event.target.files?.[0])} />
      </label>
    </div>
  );
}
