import { useEffect, useId, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
export default function QrScanner({
  onScan,
}: {
  onScan: (text: string) => void;
}) {
  const id = `qr-${useId().replace(/:/g, "")}`;
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let accepted = false;
    const timer = window.setTimeout(() => {
      scanner = new Html5QrcodeScanner(
        id,
        {
          fps: 10,
          qrbox: (w, h) => ({
            width: Math.min(230, w * 0.8),
            height: Math.min(230, h * 0.8),
          }),
          videoConstraints: { facingMode: "environment" },
        },
        false,
      );
      scanner.render(
        (text) => {
          if (accepted) return;
          accepted = true;
          onScanRef.current(text);
        },
        () => {},
      );
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (scanner) void scanner.clear().catch(console.error);
    };
  }, [id]);
  return (
    <div className="qr-scanner">
      <div id={id} />
      <small>
        カメラ映像は左右反転せずに表示します。
      </small>
    </div>
  );
}
