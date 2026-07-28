/**
 * WelcomePage — sports hero splash screen.
 * Tap the button → quick fade out → onEnter().
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [exiting, setExiting] = useState(false);
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleEnter = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(finish, 500);
  };

  return (
    <motion.div
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        background: "#0d1b2e",
        overflow: "hidden",
        paddingTop: "max(env(safe-area-inset-top), 28px)",
      }}
    >
      {/* ── Hero image — fills most of the screen ── */}
      <div style={{
        flex: 1,
        width: "100%",
        minHeight: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflow: "hidden",
      }}>
        <img
          src="/sports-hero.png"
          alt="My Digital Sports"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
            userSelect: "none",
            pointerEvents: "none",
            display: "block",
          }}
        />
      </div>

      {/* ── Bottom bar — button + footer ── */}
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
        {/* CTA */}
        <button
          onClick={handleEnter}
          disabled={exiting}
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
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
            whiteSpace: "nowrap",
          }}
        >
          Open My Locker →
        </button>

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
