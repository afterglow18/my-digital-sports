/**
 * QuickAddSheet — photo upload with on-device background removal.
 *
 * Every photo (camera or gallery) goes through:
 *   pick → encoding → preview (Original | Cleaned ✨) → save → [next photo | close]
 *
 * For multi-select gallery picks, photos are processed one at a time.
 * A "Photo X of Y" counter is shown when queue length > 1.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check, RotateCcw } from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
  getWardrobeStatsQueryKey,
} from "@/hooks/useLocalDB";
import { useCategoryNames } from "@/hooks/useCategoryNames";
import { useQueryClient } from "@tanstack/react-query";
import {
  removeBackground,
  blobToDataUrl as bgBlobToDataUrl,
  dataUrlToBlob,
  blobToStorageDataUrl,
} from "@/lib/backgroundRemoval";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "outfits" | "beauty" | "toiletries" | "essentials";

const CATEGORY_LABELS: Record<Category, string> = {
  outfits:    "Outfits",
  beauty:     "Beauty",
  toiletries: "Toiletries",
  essentials: "Essentials",
};

type Phase =
  | "pick"       // two-button landing screen
  | "encoding"   // full-screen spinner while canvas encodes the photo
  | "preview"    // side-by-side original | cleaned comparison
  | "uploading"; // saving to DB

// ── encodeForUpload ───────────────────────────────────────────────────────────

/** Resize to ≤ 2048px and return a JPEG blob ready for background removal. */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX   = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w     = Math.round(img.naturalWidth  * scale);
      const h     = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// ── Category metadata ─────────────────────────────────────────────────────────

const PHOTO_TIPS = [
  "Photograph one sports item, team photo, or document at a time.",
  "Place the item on a clean, uncluttered background.",
  "Take the photo from directly above or straight on.",
  "Keep the entire item fully in frame.",
] as const;

const CATEGORY_EXAMPLES: Record<string, { emoji: string; items: string[] }> = {
  outfits:    { emoji: "👗", items: ["Tops", "Bottoms", "Shoes", "Swim", "Undergarments", "Dresses", "Accessories"] },
  beauty:     { emoji: "💄", items: ["Makeup", "Skincare", "Hair", "Jewelry", "Nail Polish"] },
  toiletries: { emoji: "🪥", items: ["Shower", "Dental", "Medicine", "Feminine Care", "First Aid"] },
  essentials: { emoji: "🧳", items: ["Travel Docs", "Tech", "Snacks", "Books", "Accessories"] },
};

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  onCreated?:    (item: import("@/lib/db").ClothingItem) => void;
}

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const [phase,        setPhase]        = useState<Phase>("pick");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  // ── Photo queue (multi-select) ────────────────────────────────────────────
  const [fileQueue,    setFileQueue]    = useState<File[]>([]);
  const [queueIndex,   setQueueIndex]   = useState(0);
  // savedCount tracks how many items have already been committed (for auto-naming)
  const [savedCount,   setSavedCount]   = useState(0);

  // ── Background-removal state ──────────────────────────────────────────────
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");
  // Generation counter — prevents a slow first photo from clobbering a fast second one
  const bgGenRef = useRef(0);

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  const { names: categoryNames } = useCategoryNames();
  const label = categoryNames[category] ?? CATEGORY_LABELS[category];

  // ── Full reset / close ────────────────────────────────────────────────────

  const resetPreviewState = useCallback(() => {
    bgGenRef.current += 1;
    setBgProcessing(false);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
  }, []);

  const handleClose = useCallback(() => {
    resetPreviewState();
    setPhase("pick");
    setErrorMsg(null);
    setFileQueue([]);
    setQueueIndex(0);
    setSavedCount(0);
    onOpenChange(false);
  }, [resetPreviewState, onOpenChange]);

  // ── Save a single blob to the DB ──────────────────────────────────────────

  const saveBlobToDB = useCallback(async (blob: Blob, itemIndex: number): Promise<void> => {
    const dataUrl  = await blobToStorageDataUrl(blob);
    const n        = itemIndex + 1;
    const autoName = n === 1 ? label : `${label} ${n}`;
    await new Promise<void>((resolve, reject) => {
      createItem.mutate(
        { data: { name: autoName, category, imageObjectPath: dataUrl } },
        {
          onSuccess: (createdItem) => {
            queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
            queryClient.invalidateQueries({ queryKey: getWardrobeStatsQueryKey() });
            if (onCreated) onCreated(createdItem);
            resolve();
          },
          onError: reject,
        },
      );
    });
  }, [label, category, createItem, queryClient, onCreated]);

  // ── Encode + start BG removal for one file ────────────────────────────────

  const processFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    resetPreviewState();
    const myGen = bgGenRef.current; // resetPreviewState already bumped it
    setPhase("encoding");

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }
    if (bgGenRef.current !== myGen) return;

    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    // Background removal — generation guard discards stale results
    setBgProcessing(true);
    try {
      const dataUrl   = await bgBlobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, [resetPreviewState]);

  // ── Input handler — queue every pick ─────────────────────────────────────

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setFileQueue(files);
    setQueueIndex(0);
    setSavedCount(0);
    processFile(files[0]);
  }, [processFile]);

  // ── Save current preview → next in queue or close ────────────────────────

  const handleSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob) return;
    setPhase("uploading");
    try {
      await saveBlobToDB(blob, existingCount + savedCount);
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
      return;
    }

    const nextCount = savedCount + 1;
    setSavedCount(nextCount);

    const nextIndex = queueIndex + 1;
    if (nextIndex < fileQueue.length) {
      setQueueIndex(nextIndex);
      processFile(fileQueue[nextIndex]);
    } else {
      handleClose();
    }
  }, [
    selected, cleanedBlob, originalBlob,
    saveBlobToDB, existingCount, savedCount,
    queueIndex, fileQueue,
    processFile, handleClose,
  ]);

  if (!open) return null;

  const queueTotal   = fileQueue.length;
  const showCounter  = queueTotal > 1;
  const photoNumber  = queueIndex + 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight leading-none">
            Add {label}
          </h2>
          {showCounter && phase !== "pick" && (
            <p className="text-xs font-bold text-black/40 uppercase tracking-widest mt-0.5">
              Photo {photoNumber} of {queueTotal}
            </p>
          )}
        </div>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Body — NO AnimatePresence on phase switches ─────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── PICK ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3">
              {/* Take Photo */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-primary
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Take<br />Photo
                </span>
              </button>

              {/* Upload Photo */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photo
                </span>
              </button>
            </div>

            {/* Photo tips */}
            <div className="border-2 border-black rounded-2xl bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                     flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── ENCODING — shown immediately after pick ── */}
        {phase === "encoding" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20, padding: 24,
          }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-black/45 mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* ── PREVIEW — side-by-side original / cleaned ── */}
        {phase === "preview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <p style={{
              textAlign: "center", fontWeight: 700, fontSize: 11,
              textTransform: "uppercase", letterSpacing: 2, opacity: 0.45,
              margin: 0,
            }}>
              {bgProcessing ? "This will take a moment…" : bgFailed ? "Original only" : "Tap to choose"}
            </p>

            {/* Side-by-side cards */}
            <div style={{ display: "flex", gap: 12 }}>

              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                style={{
                  flex: 1,
                  opacity: selected === "original" ? 1 : 0.5,
                  border: selected === "original" ? "4px solid black" : "4px solid rgba(0,0,0,0.18)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: "pointer",
                }}
              >
                <div style={{ background: "#1a1a1a", minHeight: 180, position: "relative" }}>
                  {originalUrl && (
                    <img
                      src={originalUrl}
                      alt="Original"
                      style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
                    />
                  )}
                  {selected === "original" && (
                    <div style={{
                      position: "absolute", top: 6, right: 6, width: 22, height: 22,
                      borderRadius: "50%", background: "black",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={13} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{
                  textAlign: "center", fontWeight: 700, fontSize: 11,
                  textTransform: "uppercase", padding: "7px 0", margin: 0,
                  background: "#f9f4ee",
                }}>
                  Original
                </p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                style={{
                  flex: 1,
                  opacity: selected === "cleaned" && cleanedUrl ? 1 : 0.5,
                  border: selected === "cleaned" && cleanedUrl ? "4px solid black" : "4px solid rgba(0,0,0,0.18)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: cleanedUrl ? "pointer" : "default",
                }}
              >
                {/* Checkerboard reveals transparency */}
                <div style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                  minHeight: 180, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cleanedUrl ? (
                    <>
                      <img
                        src={cleanedUrl}
                        alt="Cleaned"
                        style={{ width: "100%", objectFit: "contain", maxHeight: 180, display: "block" }}
                      />
                      {selected === "cleaned" && (
                        <div style={{
                          position: "absolute", top: 6, right: 6, width: 22, height: 22,
                          borderRadius: "50%", background: "black",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Check size={13} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p style={{
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      opacity: 0.4, textAlign: "center", padding: "0 12px", margin: 0,
                    }}>
                      Could not remove background
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={32} style={{ opacity: 0.45 }} className="animate-spin" />
                      <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", opacity: 0.45, margin: 0 }}>
                        Processing
                      </p>
                    </div>
                  )}
                </div>
                <p style={{
                  textAlign: "center", fontWeight: 700, fontSize: 11,
                  textTransform: "uppercase", padding: "7px 0", margin: 0,
                  background: "#f9f4ee",
                }}>
                  Cleaned ✨
                </p>
              </button>
            </div>

            {/* Action row */}
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {/* Retake / Back */}
              <button
                onClick={() => { bgGenRef.current += 1; setBgProcessing(false); setPhase("pick"); }}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl
                           border-4 border-black bg-white font-display font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                {showCounter ? "Skip" : "Retake"}
              </button>

              {/* Save — enabled as soon as the chosen version is ready */}
              <button
                onClick={handleSave}
                disabled={selected === "cleaned" ? !cleanedUrl : !originalBlob}
                className="flex-1 py-3 rounded-2xl border-4 border-black font-display font-bold
                           text-base uppercase tracking-tight bg-black text-white
                           shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {selected === "cleaned" && !cleanedUrl
                  ? "Processing…"
                  : showCounter && photoNumber < queueTotal
                    ? "✓ Save & Next"
                    : "✓ Save to Locker"}
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20, padding: 24,
          }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-black/45 mt-1">Adding to your locker.</p>
            </div>
          </div>
        )}

      </div>

      {/* ── Hidden file inputs ──────────────────────────────────────────────── */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
