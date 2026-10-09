import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { prepareZXingModule, readBarcodes, writeBarcode } from "zxing-wasm/full";
import { makeQr, parseQr } from "../src/domain";

test("trial reader decodes generated Micro QR and current QR payloads", async () => {
  const bytes = await readFile(
    new URL("../node_modules/zxing-wasm/dist/full/zxing_full.wasm", import.meta.url),
  );
  await prepareZXingModule({
    fireImmediately: true,
    overrides: { wasmBinary: new Uint8Array(bytes) },
  });
  const payload = makeQr(2, 103);
  const widths: number[] = [];
  for (const format of ["MicroQRCode", "QRCode"] as const) {
    const output = await writeBarcode(payload, {
      format,
      options: "ecLevel=M",
      scale: 12,
      addQuietZones: true,
    });
    assert.equal(output.error, "");
    assert.ok(output.image);
    widths.push(output.symbol.width);
    const results = await readBarcodes(output.image, {
      formats: ["MicroQRCode", "QRCode"],
      tryHarder: true,
      maxNumberOfSymbols: 1,
    });
    const found = results.find((item) => item.isValid);
    assert.equal(found?.format, format);
    assert.equal(found?.text, payload);
    assert.deepEqual(parseQr(found!.text), { eventNumber: 2, specimenNumber: 103 });
  }
  assert.ok(widths[0] < widths[1], "Micro QR must use fewer modules than QR");
});
