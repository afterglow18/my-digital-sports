/**
 * useCategoryNames — shared, persisted category display names.
 *
 * Uses a module-level pub/sub store so any mounted component (wardrobe, generate)
 * stays in sync when another component renames a category in the same session.
 * Names are also persisted to localStorage so they survive page reloads.
 */

import { useCallback, useEffect, useReducer } from "react";

const STORAGE_KEY = "mds_category_names";

export type RowKey = "outfits" | "beauty" | "toiletries" | "essentials";

export const CATEGORY_DEFAULTS: Record<RowKey, string> = {
  outfits:    "Outfits",
  beauty:     "Beauty",
  toiletries: "Toiletries",
  essentials: "Essentials",
};

// ── Module-level singleton ────────────────────────────────────────────────────

function loadFromStorage(): Record<RowKey, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<RowKey, string>>;
      return { ...CATEGORY_DEFAULTS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...CATEGORY_DEFAULTS };
}

let _names: Record<RowKey, string> = loadFromStorage();
const _listeners = new Set<() => void>();

function notifyAll() {
  _listeners.forEach(fn => fn());
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCategoryNames() {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(forceUpdate);
    return () => { _listeners.delete(forceUpdate); };
  }, []);

  const setName = useCallback((key: RowKey, name: string) => {
    const trimmed = name.trim() || CATEGORY_DEFAULTS[key];
    _names = { ..._names, [key]: trimmed };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_names)); } catch { /* ignore */ }
    notifyAll();
  }, []);

  return { names: _names, setName };
}
