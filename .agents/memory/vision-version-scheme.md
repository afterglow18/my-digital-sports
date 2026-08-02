---
name: Vision indexer version scheme
description: visionVersion values used by useVisionIndexer — what each means and the re-index rule.
---

# Vision indexer version scheme

## The rule
Re-index when `visionVersion === undefined || visionVersion === 0 || visionVersion === 1`.

## Version values

| v | Meaning |
|---|---------|
| undefined / 0 | Unanalyzed |
| 1 | Legacy: iOS VNClassifyImageRequest only — no canvas color names. **Re-indexed on next open.** |
| 2 | Current native: Vision labels + canvas color extraction merged (deduped). |
| 4 | Web canvas analyzed, labels found. |
| 5 | Web canvas analyzed, no labels found — don't retry. |

**Why v1 is re-indexed:** Apple Vision outputs object types ("shoe", "high heel") but never color names. v1 items are missing color search entirely. The fix (v2) runs `extractWebColors` in parallel with `VisionNative.analyze` and merges the results.

## Key files
- `artifacts/outfit-generator/src/lib/visionIndexer.ts` — `analyzeImage()` and the filter
- `artifacts/outfit-generator/src/lib/visionWeb.ts` — `extractWebColors()` (canvas 48×48 pixel mapping)
- `artifacts/outfit-generator/src/lib/localDB.ts` — `updateVisionFields()`
