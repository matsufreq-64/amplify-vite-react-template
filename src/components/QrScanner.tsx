import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type QrScannerProps = {
  onScan: (text: string) => void;
};

export default function QrScanner({ onScan }: QrScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
      },
      () => {
        // 読み取れない間は何もしない
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScan]);

  return <div id="qr-reader" />;
}