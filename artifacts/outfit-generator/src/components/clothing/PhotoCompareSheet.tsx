/**
 * PhotoCompareSheet — full-screen slide-up overlay that lets the user choose
 * between the original photo and a background-removed version.
 *
 * Runs @imgly/background-removal fully on-device (WASM, no server).
 * Calls onConfirm(chosenDataUrl) with a storage-ready data URL when the user saves.
 * The caller is responsible for the DB write; this sheet only picks the winner.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import {
  removeBackground,
  dataUrlToBlob,
  blobToStorageDataUrl,
} from "@/lib/backgroundRemoval";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "removing" | "compare" | "failed";
type Selection = "original" | "cleaned";

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  /** The currently-stored data URL — shown as "Original". */
  originalDataUrl: string;
  /** Called with the storage-ready data URL the user confirmed. */
  onConfirm: (chosenDataUrl: string) => void;
}

// ── Checkmark badge ───────────────────────────────────────────────────────────

function CheckBadge() {
  return (
    <div
      style={{
        position: "absolute", top: 8, right: 8,
        width: 26, height: 26, borderRadius: "50%",
        background: "#ec4899",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      {/* inline SVG check — avoids lucide tree-shaking edge cases at this z-level */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhotoCompareSheet({ open, onOpenChange, originalDataUrl, onConfirm }: Props) {
  const [phase,       setPhase]       = useState<Phase>("removing");
  const [cleanedUrl,  setCleanedUrl]  = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Selection>("cleaned");
  const [saving,      setSaving]      = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const genRef = useRef(0);

  // ── Kick off background removal whenever the sheet opens ──────────────────
  useEffect(() => {
    if (!open) return;

    const myGen = ++genRef.current;
    setPhase("removing");
    setCleanedUrl(null);
    setSelected("cleaned");
    setSaving(false);
    setErrorMsg(null);

    removeBackground(originalDataUrl)
      .then((resultDataUrl) => {
        if (genRef.current !== myGen) return;
        setCleanedUrl(resultDataUrl);
        setPhase("compare");
      })
      .catch((err) => {
        if (genRef.current !== myGen) return;
        console.warn("Background removal failed:", err);
        setErrorMsg("Background removal failed. Please try again.");
        setPhase("failed");
      });

    return () => { genRef.current += 1; }; // cancel on unmount / re-open
  }, [open, originalDataUrl]);

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    genRef.current += 1;
    onOpenChange(false);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      let storageUrl: string;
      if (selected === "cleaned" && cleanedUrl) {
        // Resize cleaned PNG to ≤ 800 px before handing to caller
        const blob = await dataUrlToBlob(cleanedUrl);
        storageUrl = await blobToStorageDataUrl(blob);
      } else {
        storageUrl = originalDataUrl; // original is already stored as-is
      }
      onConfirm(storageUrl);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to prepare image:", err);
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[75] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Clean Up Photo
        </h2>
        <button
          onClick={handleClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* REMOVING — spinner while AI processes */}
        {phase === "removing" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20, padding: 32,
          }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Removing Background…</p>
              <p className="text-sm text-black/45 mt-1">This happens fully on your device.</p>
            </div>
          </div>
        )}

        {/* FAILED */}
        {phase === "failed" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16, padding: 32,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, background: "#fef2f2",
              border: "3px solid #fca5a5",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
            }}>
              😕
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-xl uppercase tracking-tight">Couldn't Clean Photo</p>
              <p className="text-sm text-black/50 mt-1 max-w-xs mx-auto">
                {errorMsg ?? "Something went wrong. Please try again."}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="mt-2 px-8 py-3 border-4 border-black rounded-2xl bg-white font-display
                         font-bold text-sm uppercase tracking-tight
                         shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
            >
              Close
            </button>
          </div>
        )}

        {/* COMPARE — side-by-side cards */}
        {phase === "compare" && cleanedUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20 }}>

            {/* Instruction */}
            <p style={{
              textAlign: "center", fontWeight: 700, fontSize: 11,
              textTransform: "uppercase", letterSpacing: 2,
              color: "rgba(0,0,0,0.4)", margin: 0,
            }}>
              Tap to choose
            </p>

            {/* Cards */}
            <div style={{ display: "flex", gap: 14 }}>

              {/* Original */}
              <button
                onClick={() => setSelected("original")}
                style={{
                  flex: 1, padding: 0, background: "none",
                  border: selected === "original"
                    ? "4px solid #ec4899"
                    : "4px solid rgba(0,0,0,0.12)",
                  borderRadius: 18, overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: selected === "original"
                    ? "0 0 0 2px rgba(236,72,153,0.18)"
                    : "none",
                  opacity: selected === "original" ? 1 : 0.55,
                  transition: "all 0.15s ease",
                }}
              >
                {/* Dark bg so any white edges read */}
                <div style={{ background: "#1c1c1e", minHeight: 200, position: "relative" }}>
                  <img
                    src={originalDataUrl}
                    alt="Original"
                    style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
                  />
                  {selected === "original" && <CheckBadge />}
                </div>
                <div style={{
                  textAlign: "center", fontWeight: 700, fontSize: 11,
                  textTransform: "uppercase", letterSpacing: 1,
                  padding: "8px 0", background: "#f9f4ee",
                  color: selected === "original" ? "#ec4899" : "rgba(0,0,0,0.5)",
                }}>
                  Original
                </div>
              </button>

              {/* Cleaned */}
              <button
                onClick={() => setSelected("cleaned")}
                style={{
                  flex: 1, padding: 0, background: "none",
                  border: selected === "cleaned"
                    ? "4px solid #ec4899"
                    : "4px solid rgba(0,0,0,0.12)",
                  borderRadius: 18, overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: selected === "cleaned"
                    ? "0 0 0 2px rgba(236,72,153,0.18)"
                    : "none",
                  opacity: selected === "cleaned" ? 1 : 0.55,
                  transition: "all 0.15s ease",
                }}
              >
                {/* Checkerboard reveals transparency */}
                <div style={{
                  background: "repeating-conic-gradient(#cbd5e1 0% 25%, white 0% 50%) 0 0 / 14px 14px",
                  minHeight: 200, position: "relative",
                }}>
                  <img
                    src={cleanedUrl}
                    alt="Cleaned"
                    style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
                  />
                  {selected === "cleaned" && <CheckBadge />}
                </div>
                <div style={{
                  textAlign: "center", fontWeight: 700, fontSize: 11,
                  textTransform: "uppercase", letterSpacing: 1,
                  padding: "8px 0", background: "#f9f4ee",
                  color: selected === "cleaned" ? "#ec4899" : "rgba(0,0,0,0.5)",
                }}>
                  Cleaned ✨
                </div>
              </button>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 rounded-2xl border-4 border-black font-display font-bold
                         text-base uppercase tracking-tight bg-black text-white
                         shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-1 active:translate-y-1 active:shadow-none
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving
                ? "Saving…"
                : selected === "cleaned"
                  ? "Save Cleaned Version"
                  : "Save Original"}
            </button>

            {/* Cancel link */}
            <button
              onClick={handleClose}
              className="w-full py-2 text-sm font-bold uppercase tracking-wider text-black/35
                         hover:text-black/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

      </div>
    </motion.div>
  );
}
