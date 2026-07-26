import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

// ── ORT configuration ─────────────────────────────────────────────────────────
//
// Problem: @imgly/background-removal runs ONNX inference on the main JS thread by
// default, freezing the UI for several seconds. ONNX Runtime Web has a wasm.proxy
// flag that moves inference into a Web Worker — but imgly unconditionally resets it
// to false internally (it only enables the proxy when WebGPU is available, which
// WKWebView/iOS Safari never reports).
//
// Fix — three parts:
//
// 1. Object.defineProperty with a no-op setter so imgly's "proxy = false" write is
//    silently swallowed and the value stays true. ONNX Runtime then spins up a
//    sub-worker and runs inference there, keeping the main thread responsive.
//
// 2. numThreads = 1. iOS Safari has no SharedArrayBuffer, which WASM multi-
//    threading requires. Leaving threads > 1 causes a silent crash.
//
// 3. Dynamic import() instead of a top-level import. Importing onnxruntime-web at
//    module parse time triggers Vite's dependency pre-bundler mid-session, causing a
//    full page reload that corrupts React's internal dispatcher. Importing it lazily
//    means it only loads at the moment inference is first requested — after React is
//    fully stable.

let ortConfigured = false;

async function configureOrt(): Promise<void> {
  if (ortConfigured) return;
  ortConfigured = true;

  // Dynamic import — see note 3 above.
  // @ts-ignore — onnxruntime-web types.d.ts exists but isn't reachable via the
  // package's "exports" map; the runtime shape is correct, types just don't resolve.
  const ort = await import("onnxruntime-web");

  // Lock proxy = true — see note 1 above
  Object.defineProperty(ort.env.wasm, "proxy", {
    get: () => true,
    set: () => {},      // blocks imgly's internal "proxy = false" reset
    configurable: true, // allow re-definition if ort is re-imported
  });

  // Single-threaded — see note 2 above
  ort.env.wasm.numThreads = 1;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with a transparent background.
 *
 * On first ever call: configures ONNX Runtime Web (Web Worker + single-thread)
 * then downloads the ~15 MB isnet_fp16 model from the imgly CDN (cached after that).
 * Throws on network error or unreadable image — callers should catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16", // valid: "isnet" | "isnet_fp16" | "isnet_quint8" — NOT "small"/"medium"
    output: { format: "image/png", quality: 0.9 },
    // publicPath omitted → uses static imgly CDN automatically
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Resize a blob to ≤ 800 px and return a base64 data-URL suitable for DB storage.
 * PNG blobs keep their alpha channel; others are encoded as JPEG.
 */
export function blobToStorageDataUrl(blob: Blob): Promise<string> {
  const isPng = blob.type === "image/png";
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX   = 800;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w     = Math.round(img.naturalWidth  * scale);
      const h     = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      if (isPng) ctx.clearRect(0, 0, w, h); // keep transparency
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to resize image for storage"));
    };
    img.src = objectUrl;
  });
}
