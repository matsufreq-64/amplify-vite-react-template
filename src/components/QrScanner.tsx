import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type QrScannerProps = {
  onScan: (text: string) => void;
};

export default function QrScanner({ onScan }: QrScannerProps) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    // StrictModeの最初の後片付けで取り消せるよう、描画を次の処理へ送る
    const timer = window.setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText) => onScanRef.current(decodedText),
        () => {}
      );

      activeScanner = scanner;
    }, 0);

    let activeScanner: Html5QrcodeScanner | null = null;

    return () => {
      window.clearTimeout(timer);
      if (activeScanner) {
        void activeScanner.clear().catch(console.error);
      }
    };
  }, []);

  return <div id="qr-reader" />;
}