/**
 * WelcomePage — locker door reveal splash screen.
 *
 * State machine:
 *   "closed"  → both locker-door panels cover the hero image
 *   "opening" → doors swing open (rotateY ±90°) on button tap
 *   "open"    → hero fully visible; screen fades out → onEnter()
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props { onEnter: () => void; }

type DoorState = "closed" | "opening" | "open";

// One shared easing for both door panels
const DOOR_EASE  = [0.22, 1, 0.36, 1] as const;
const DOOR_DURATION = 0.75;

export default function WelcomePage({ onEnter }: Props) {
  const [doorState, setDoorState] = useState<DoorState>("closed");
  const calledRef   = useRef(false);
  const resolvedRef = useRef(false);   // fires onEnter only once

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (doorState !== "closed") return;
    setDoorState("opening");
  };

  // Called when either door completes its rotation — guard with ref so it fires once
  const handleDoorComplete = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setDoorState("open");
    setTimeout(finish, 550);   // brief hero reveal, then fade + proceed
  }, [finish]);

  const isOpening = doorState === "opening" || doorState === "open";
  const isFading  = doorState === "open";

  return (
    <motion.div
      animate={{ opacity: isFading ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeIn", delay: isFading ? 0.25 : 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        background: "#0d1b2e",
        overflow: "hidden",
        paddingTop: "max(env(safe-area-inset-top), 28px)",
      }}
    >
      {/* ── Image area ── */}
      <div style={{
        flex: 1,
        position: "relative",
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}>
        {/* Hero image — always mounted, revealed by doors opening */}
        <img
          src="/sports-hero.png"
          alt="My Digital Sports"
          draggable={false}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            userSelect: "none",
            pointerEvents: "none",
            display: "block",
          }}
        />

        {/* ── Door panels — perspective wrapper ── */}
        <div style={{
          position: "absolute", inset: 0,
          perspective: "900px",
          pointerEvents: isOpening ? "none" : "auto",
        }}>
          <DoorPanel side="left"  open={isOpening} onComplete={handleDoorComplete} />
          <DoorPanel side="right" open={isOpening} onComplete={handleDoorComplete} />

          {/* Center seam / lock badge — fades out as doors open */}
          <AnimatePresence>
            {!isOpening && (
              <motion.div
                key="seam"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  zIndex: 32,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  pointerEvents: "none",
                }}
              >
                {/* Lock icon */}
                <div style={{
                  width: 44, height: 44,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1a3a6a, #0d2040)",
                  border: "2px solid rgba(184,224,245,0.45)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                    <rect x="3" y="10" width="14" height="10" rx="2" fill="#B8E0F5" opacity="0.9"/>
                    <path d="M6 10V7a4 4 0 0 1 8 0v3" stroke="#B8E0F5" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
                    <circle cx="10" cy="15" r="1.5" fill="#0d2040"/>
                  </svg>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        flexShrink: 0,
        width: "100%",
        background: "#0d1b2e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "20px 32px",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
      }}>
        <motion.button
          onClick={handleOpen}
          disabled={isOpening}
          whileTap={!isOpening ? { scale: 0.97 } : undefined}
          animate={{ opacity: isOpening ? 0.4 : 1 }}
          transition={{ duration: 0.2 }}
          style={{
            width: "100%",
            maxWidth: 340,
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#fff",
            background: "linear-gradient(135deg, #1a5fa8 0%, #0f3d6e 100%)",
            border: "2px solid rgba(255,255,255,0.18)",
            borderRadius: 100,
            padding: "15px 40px",
            cursor: isOpening ? "default" : "pointer",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
            whiteSpace: "nowrap",
          }}
        >
          Open My Locker →
        </motion.button>

        {/* Legal links */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <a
            href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.28)", textDecoration: "none", letterSpacing: "0.02em" }}
          >
            Privacy Policy
          </a>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>•</span>
          <a
            href="https://app.notion.com/p/My-Digital-Sports-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.28)", textDecoration: "none", letterSpacing: "0.02em" }}
          >
            Support
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ── Door panel component ───────────────────────────────────────────────────────

interface DoorPanelProps {
  side: "left" | "right";
  open: boolean;
  onComplete: () => void;
}

function DoorPanel({ side, open, onComplete }: DoorPanelProps) {
  const isLeft = side === "left";

  return (
    <motion.div
      initial={false}
      animate={{ rotateY: open ? (isLeft ? -92 : 92) : 0 }}
      transition={{ duration: DOOR_DURATION, ease: DOOR_EASE }}
      onAnimationComplete={() => { if (open) onComplete(); }}
      style={{
        position: "absolute",
        top: 0,
        left:   isLeft ? 0    : "50%",
        width: "50%",
        height: "100%",
        transformOrigin: isLeft ? "0% 50%" : "100% 50%",
        zIndex: 30,
        // Locker door surface
        background: `
          repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.035) 0px,
            rgba(255,255,255,0.035) 1px,
            transparent 1px,
            transparent 22px
          ),
          linear-gradient(
            to bottom,
            #0a1628 0%,
            #162b55 25%,
            #0e2040 50%,
            #162b55 75%,
            #0a1628 100%
          )
        `,
        // Edge shadow toward center seam
        boxShadow: isLeft
          ? "inset -8px 0 18px rgba(0,0,0,0.55)"
          : "inset  8px 0 18px rgba(0,0,0,0.55)",
        // Sky-blue accent edge at the seam
        borderRight: isLeft ? "1.5px solid rgba(184,224,245,0.2)" : "none",
        borderLeft:  isLeft ? "none" : "1.5px solid rgba(184,224,245,0.2)",
      }}
    >
      {/* Vertical accent stripe near seam edge */}
      <div style={{
        position: "absolute",
        top: 0, bottom: 0,
        width: 3,
        right:  isLeft ? 12 : undefined,
        left:   isLeft ? undefined : 12,
        background: "linear-gradient(to bottom, transparent, rgba(26,159,216,0.35), rgba(26,159,216,0.55), rgba(26,159,216,0.35), transparent)",
        borderRadius: 2,
      }} />

      {/* Door handle */}
      <div style={{
        position: "absolute",
        top: "50%",
        right:  isLeft ? 18 : undefined,
        left:   isLeft ? undefined : 18,
        transform: "translateY(-50%)",
        width: 7,
        height: 52,
        borderRadius: 4,
        background: "linear-gradient(to bottom, #B8E0F5, #1A9FD8, #B8E0F5)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
      }} />

      {/* Subtle "MY DIGITAL SPORTS" wordmark watermark */}
      <div style={{
        position: "absolute",
        bottom: "18%",
        left: 0, right: 0,
        textAlign: "center",
        fontFamily: "var(--font-display, sans-serif)",
        fontWeight: 900,
        fontSize: 9,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "rgba(184,224,245,0.18)",
        userSelect: "none",
        pointerEvents: "none",
      }}>
        {isLeft ? "MY DIGITAL" : "SPORTS"}
      </div>
    </motion.div>
  );
}
