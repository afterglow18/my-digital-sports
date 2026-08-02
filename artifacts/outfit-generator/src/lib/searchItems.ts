/**
 * searchItems — weighted full-text search across all locally stored item fields.
 *
 * Field weights (higher = surfaces result first):
 *   name / brand        100 / 80   — user-entered primary identifiers
 *   color / category     60 / 50   — key attributes
 *   notes / size / season / occasion / price / date  35–20
 *   visionLabels / visionText  15 / 10   — auto-generated, lowest weight
 *
 * Group scoring:
 *   group name / notes  80 / 30
 *   items inside group  up to 50 bonus per matching item
 */

import type { ClothingItem, SavedOutfit } from "@/lib/db";

export interface SearchResults {
  items:  ClothingItem[];
  groups: SavedOutfit[];
}

// ── Item scoring ──────────────────────────────────────────────────────────────

function scoreItem(item: ClothingItem, q: string): number {
  let score = 0;

  const hit = (val: string | null | undefined, weight: number) => {
    if (val && val.toLowerCase().includes(q)) score += weight;
  };

  hit(item.name,          100);
  hit(item.brand,          80);
  hit(item.color,          60);
  hit(item.category,       50);
  hit(item.notes,          35);
  hit(item.size,           35);
  hit(item.season,         35);
  hit(item.occasion,       35);
  hit(item.purchasePrice,  30);
  hit(item.purchaseDate,   20);

  if (item.visionLabels?.some((l) => l.toLowerCase().includes(q))) score += 15;
  if (item.visionText?.some((t)  => t.toLowerCase().includes(q))) score  += 10;

  return score;
}

// ── Main search ───────────────────────────────────────────────────────────────

export function searchAll(
  query:     string,
  allItems:  ClothingItem[],
  allGroups: SavedOutfit[],
): SearchResults {
  const q = query.toLowerCase().trim();
  if (!q) return { items: [], groups: [] };

  // Score every item
  const itemScores = new Map<number, number>();
  for (const item of allItems) {
    const s = scoreItem(item, q);
    if (s > 0) itemScores.set(item.id, s);
  }

  // Score groups; also pull in item matches from inside groups
  const groupScores = new Map<number, number>();
  for (const group of allGroups) {
    let score = 0;
    if (group.name.toLowerCase().includes(q))    score += 80;
    if (group.notes?.toLowerCase().includes(q))  score += 30;

    for (const item of group.items ?? []) {
      const is = scoreItem(item, q);
      if (is > 0) {
        score += Math.min(is * 0.5, 50);
        // also surface this item in the items section
        if (!itemScores.has(item.id)) itemScores.set(item.id, is);
      }
    }

    if (score > 0) groupScores.set(group.id, score);
  }

  const items = allItems
    .filter((i) => itemScores.has(i.id))
    .sort((a, b) => (itemScores.get(b.id) ?? 0) - (itemScores.get(a.id) ?? 0));

  const groups = allGroups
    .filter((g) => groupScores.has(g.id))
    .sort((a, b) => (groupScores.get(b.id) ?? 0) - (groupScores.get(a.id) ?? 0));

  return { items, groups };
}
