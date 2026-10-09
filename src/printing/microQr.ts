import { prepareZXingModule, writeBarcode } from "zxing-wasm/full";

let browserReady: Promise<unknown> | undefined;
async function ensureReady() {
  if (typeof window === "undefined") return;
  browserReady ??= import("zxing-wasm/full/zxing_full.wasm?url").then(
    ({ default: wasmUrl }) =>
      prepareZXingModule({
        fireImmediately: true,
        overrides: {
          locateFile: (path, prefix) =>
            path.endsWith(".wasm") ? wasmUrl : prefix + path,
        },
      }),
  );
  await browserReady;
}

export async function microQrPng(value: string) {
  await ensureReady();
  const result = await writeBarcode(value, {
    format: "MicroQRCode",
    options: "ecLevel=M",
    scale: 16,
    addQuietZones: true,
  });
  if (!result.image || result.error)
    throw new Error(result.error || "マイクロQRを作成できませんでした。");
  return new Uint8Array(await result.image.arrayBuffer());
}
