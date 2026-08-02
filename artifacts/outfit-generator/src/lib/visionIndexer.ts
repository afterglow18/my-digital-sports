/**
 * useVisionIndexer — background photo analysis hook.
 *
 * On mount and whenever the item list grows: finds all items with
 * visionVersion < 4 (or unset) and processes them one at a time with a
 * 350ms gap so the UI stays responsive.
 *
 * Version scheme:
 *   0 / undefined  — unanalyzed
 *   1              — iOS Vision analyzed
 *   4              — web canvas analyzed, labels found
 *   5              — web analyzed, no labels (don't retry)
 *
 * On web: re-run anything below version 4.
 * On iOS: try VisionPlugin first; fall back to web canvas.
 */

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { registerPlugin } from "@capacitor/core";
import { extractWebColors } from "./visionWeb";
import { updateVisionFields } from "./localDB";
import { useListClothing, getListClothingQueryKey } from "@/hooks/useLocalDB";

// ── Native Vision bridge ──────────────────────────────────────────────────────

interface VisionCapacitorPlugin {
  analyze(opts: { dataUrl: string }): Promise<{ labels: string[]; text: string[] }>;
}
const VisionNative = registerPlugin<VisionCapacitorPlugin>("VisionPlugin");

// ── Image analysis (native → web fallback) ────────────────────────────────────

async function analyzeImage(
  dataUrl: string,
): Promise<{ labels: string[]; text: string[]; version: number }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await VisionNative.analyze({ dataUrl });
      if (r.labels.length > 0 || r.text.length > 0) {
        return { labels: r.labels, text: r.text, version: 1 };
      }
    } catch { /* fall through */ }
  }

  const colors = await extractWebColors(dataUrl);
  return { labels: colors, text: [], version: colors.length > 0 ? 4 : 5 };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVisionIndexer(): { isIndexing: boolean } {
  const [isIndexing, setIsIndexing] = useState(false);
  const isRunningRef                = useRef(false);
  const processedRef                = useRef(new Set<number>());
  const qc                          = useQueryClient();
  const { data: items }             = useListClothing();

  useEffect(() => {
    if (!items?.length || isRunningRef.current) return;

    const toIndex = items.filter((item) => {
      if (processedRef.current.has(item.id)) return false;
      if (!item.imageObjectPath) return false;
      const v = item.visionVersion;
      return v === undefined || v < 4;
    });

    if (toIndex.length === 0) return;

    isRunningRef.current = true;
    setIsIndexing(true);

    (async () => {
      for (const item of toIndex) {
        processedRef.current.add(item.id);
        try {
          const result = await analyzeImage(item.imageObjectPath!);
          await updateVisionFields(item.id, {
            visionLabels:  result.labels,
            visionText:    result.text,
            visionVersion: result.version,
          });
        } catch { /* non-fatal */ }

        await new Promise((r) => setTimeout(r, 350));
      }

      setIsIndexing(false);
      isRunningRef.current = false;
      qc.invalidateQueries({ queryKey: getListClothingQueryKey() });
    })().catch(console.warn);
  }, [items?.length, qc]);

  return { isIndexing };
}
