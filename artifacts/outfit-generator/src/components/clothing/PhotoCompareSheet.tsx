/**
 * PhotoCompareSheet — full-screen slide-up overlay that lets the user choose
 * between the original photo and a background-removed version.
 *
 * Both cards are shown immediately on open. "Original" is pre-selected so the
 * user can save without waiting. The cleaned card shows a spinner while the
 * WASM model runs; once it finishes, the selection auto-switches to "Cleaned"
 * unless the user has already tapped a card themselves.
 *
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

type CleanedState = "processing" | "ready" | "failed";
type Selection    = "original"   | "cleaned";

interface Props {
  open:            boolean;
  onOpenChange:    (open: boolean) => void;
  /** The currently-stored data URL — shown as "Original". */
  originalDataUrl: string;
  /** Called with the storage-ready data URL the user confirmed. */
  onConfirm:       (chosenDataUrl: string) => void;
}

// ── Checkmark badge ───────────────────────────────────────────────────────────

function CheckBadge() {
  return (
    <div style={{
      position: "absolute", top: 8, right: 8,
      width: 26, height: 26, borderRadius: "50%",
      background: "#1a9fd8",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PhotoCompareSheet({ open, onOpenChange, originalDataUrl, onConfirm }: Props) {
  const [cleanedState, setCleanedState] = useState<CleanedState>("processing");
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  // Start with "original" selected so the user can act immediately
  const [selected,     setSelected]     = useState<Selection>("original");
  const [saving,       setSaving]       = useState(false);

  // Tracks whether the user has consciously tapped a card.
  // If true, auto-switch on completion is suppressed.
  const userPickedRef = useRef(false);
  const genRef        = useRef(0);

  // ── Kick off background removal whenever the sheet opens ─────────────────
  useEffect(() => {
    if (!open) return;

    const myGen = ++genRef.current;
    // Reset everything — show cards immediately with cleaned in "processing" state
    setCleanedState("processing");
    setCleanedUrl(null);
    setSelected("original");
    setSaving(false);
    userPickedRef.current = false;

    removeBackground(originalDataUrl)
      .then((resultDataUrl) => {
        if (genRef.current !== myGen) return;
        setCleanedUrl(resultDataUrl);
        setCleanedState("ready");
        // Only auto-switch to "Cleaned" if the user hasn't already picked something
        if (!userPickedRef.current) setSelected("cleaned");
      })
      .catch((err) => {
        if (genRef.current !== myGen) return;
        console.warn("Background removal failed:", err);
        setCleanedState("failed");
        // User stays on "original" — that's already the default
      });

    return () => { genRef.current += 1; };
  }, [open, originalDataUrl]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleClose = () => {
    genRef.current += 1;
    onOpenChange(false);
  };

  const handleSelect = (choice: Selection) => {
    // Only allow picking "cleaned" when it's actually ready
    if (choice === "cleaned" && cleanedState !== "ready") return;
    userPickedRef.current = true;
    setSelected(choice);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let storageUrl: string;
      if (selected === "cleaned" && cleanedUrl) {
        const blob = await dataUrlToBlob(cleanedUrl);
        storageUrl = await blobToStorageDataUrl(blob);
      } else {
        storageUrl = originalDataUrl;
      }
      onConfirm(storageUrl);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to prepare image:", err);
      setSaving(false);
    }
  };

  if (!open) return null;

  const cleanedSelectable = cleanedState === "ready";

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
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight leading-none">
            Clean Up Photo
          </h2>
          {cleanedState === "processing" && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/35 mt-0.5">
              Removing background…
            </p>
          )}
        </div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 20 }}>

          {/* Instruction */}
          <p style={{
            textAlign: "center", fontWeight: 700, fontSize: 11,
            textTransform: "uppercase", letterSpacing: 2,
            color: "rgba(0,0,0,0.4)", margin: 0,
          }}>
            {cleanedState === "processing" ? "Tap Original to save now, or wait for Cleaned" : "Tap to choose"}
          </p>

          {/* ── Side-by-side cards ── */}
          <div style={{ display: "flex", gap: 14 }}>

            {/* Original card — always ready and tappable */}
            <button
              onClick={() => handleSelect("original")}
              style={{
                flex: 1, padding: 0, background: "none",
                border: selected === "original"
                  ? "4px solid #1a9fd8"
                  : "4px solid rgba(0,0,0,0.12)",
                borderRadius: 18, overflow: "hidden",
                cursor: "pointer",
                boxShadow: selected === "original"
                  ? "0 0 0 2px rgba(26,159,216,0.18)"
                  : "none",
                opacity: selected === "original" ? 1 : 0.55,
                transition: "all 0.15s ease",
              }}
            >
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
                color: selected === "original" ? "#1a9fd8" : "rgba(0,0,0,0.5)",
              }}>
                Original
              </div>
            </button>

            {/* Cleaned card — spinner while processing, image when ready, error label if failed */}
            <button
              onClick={() => handleSelect("cleaned")}
              disabled={!cleanedSelectable}
              style={{
                flex: 1, padding: 0, background: "none",
                border: selected === "cleaned" && cleanedSelectable
                  ? "4px solid #1a9fd8"
                  : "4px solid rgba(0,0,0,0.12)",
                borderRadius: 18, overflow: "hidden",
                cursor: cleanedSelectable ? "pointer" : "default",
                boxShadow: selected === "cleaned" && cleanedSelectable
                  ? "0 0 0 2px rgba(26,159,216,0.18)"
                  : "none",
                opacity: cleanedSelectable ? (selected === "cleaned" ? 1 : 0.55) : 0.4,
                transition: "all 0.15s ease",
              }}
            >
              {/* Checkerboard reveals transparency */}
              <div style={{
                background: "repeating-conic-gradient(#cbd5e1 0% 25%, white 0% 50%) 0 0 / 14px 14px",
                minHeight: 200, position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {cleanedState === "processing" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <Loader2 size={34} className="animate-spin" style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: 1, opacity: 0.35 }}>
                      Processing
                    </span>
                  </div>
                )}
                {cleanedState === "ready" && cleanedUrl && (
                  <>
                    <img
                      src={cleanedUrl}
                      alt="Cleaned"
                      style={{ width: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
                    />
                    {selected === "cleaned" && <CheckBadge />}
                  </>
                )}
                {cleanedState === "failed" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    gap: 6, padding: "0 10px", textAlign: "center" }}>
                    <span style={{ fontSize: 22 }}>😕</span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: 1, opacity: 0.45 }}>
                      Couldn't remove background
                    </span>
                  </div>
                )}
              </div>
              <div style={{
                textAlign: "center", fontWeight: 700, fontSize: 11,
                textTransform: "uppercase", letterSpacing: 1,
                padding: "8px 0", background: "#f9f4ee",
                color: selected === "cleaned" && cleanedSelectable ? "#1a9fd8" : "rgba(0,0,0,0.4)",
              }}>
                Cleaned ✨
              </div>
            </button>
          </div>

          {/* Save button — enabled as soon as chosen version is ready */}
          <button
            onClick={handleSave}
            disabled={saving || (selected === "cleaned" && !cleanedUrl)}
            className="w-full py-4 rounded-2xl border-4 border-black font-display font-bold
                       text-base uppercase tracking-tight bg-black text-white
                       shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-1 active:translate-y-1 active:shadow-none
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving
              ? "Saving…"
              : selected === "cleaned" && !cleanedUrl
                ? "Processing…"
                : selected === "cleaned"
                  ? "Save Cleaned Version"
                  : "Save Original"}
          </button>

          {/* Cancel */}
          <button
            onClick={handleClose}
            className="w-full py-2 text-sm font-bold uppercase tracking-wider text-black/35
                       hover:text-black/60 transition-colors"
          >
            Cancel
          </button>

        </div>
      </div>
    </motion.div>
  );
}
