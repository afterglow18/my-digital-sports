/**
 * visionWeb — dominant color extraction from photos using an HTML canvas.
 *
 * Algorithm (matches spec):
 *  1. Draw image to 48×48 canvas.
 *  2. Sample 4×4 corner patches to detect studio background color.
 *  3. Exclude pixels within BG_TOLERANCE of the background average.
 *  4. Map surviving foreground pixels to color names.
 *  5. Include colors covering ≥ 10 % of foreground pixels.
 */

const BG_TOLERANCE = 40; // Euclidean RGB distance

// ── Color naming ──────────────────────────────────────────────────────────────

function getBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getColorName(r: number, g: number, b: number): string {
  const brightness = getBrightness(r, g, b);

  if (brightness < 80)  return "black";
  if (brightness < 110) return "dark grey";
  if (brightness < 175) return "grey";
  if (brightness < 225) return "light grey";

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  if (saturation < 0.15) return "white";

  // Brown / beige / tan before hue-based classification
  if (r > 140 && g > 100 && b < 100 && saturation < 0.65) {
    if (brightness > 200) return "beige";
    if (brightness > 140) return "tan";
    return "brown";
  }

  // Hue in degrees
  let hue: number;
  if (delta === 0) {
    hue = 0;
  } else if (max === r) {
    hue = (((g - b) / delta) % 6) * 60;
  } else if (max === g) {
    hue = ((b - r) / delta + 2) * 60;
  } else {
    hue = ((r - g) / delta + 4) * 60;
  }
  if (hue < 0) hue += 360;

  if (hue < 30 || hue >= 330) return "red";
  if (hue < 60)  return "orange";
  if (hue < 90)  return "yellow";
  if (hue < 155) return "green";
  if (hue < 195) return "teal";
  if (hue < 265) return "blue";
  if (hue < 295) return "purple";
  return "pink";
}

// ── Main extraction ───────────────────────────────────────────────────────────

export function extractWebColors(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve([]); return; }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onerror = () => resolve([]);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = 48;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve([]); return; }

        ctx.drawImage(img, 0, 0, 48, 48);
        const { data } = ctx.getImageData(0, 0, 48, 48);

        // ── Background detection: sample four 4×4 corner patches ─────────────
        const PATCH = 4;
        const cornerOrigins: [number, number][] = [
          [0, 0], [44, 0], [0, 44], [44, 44],
        ];
        let bgSumR = 0, bgSumG = 0, bgSumB = 0, bgCount = 0;

        for (const [cx, cy] of cornerOrigins) {
          for (let dy = 0; dy < PATCH; dy++) {
            for (let dx = 0; dx < PATCH; dx++) {
              const idx = ((cy + dy) * 48 + (cx + dx)) * 4;
              bgSumR += data[idx];
              bgSumG += data[idx + 1];
              bgSumB += data[idx + 2];
              bgCount++;
            }
          }
        }

        const bgR = bgSumR / bgCount;
        const bgG = bgSumG / bgCount;
        const bgB = bgSumB / bgCount;

        // ── Count foreground pixels by color name ─────────────────────────────
        const colorCounts: Record<string, number> = {};
        let foreground = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue; // transparent

          const dist = Math.sqrt(
            (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2,
          );
          if (dist < BG_TOLERANCE) continue; // background pixel

          foreground++;
          const name = getColorName(r, g, b);
          colorCounts[name] = (colorCounts[name] ?? 0) + 1;
        }

        if (foreground === 0) { resolve([]); return; }

        const threshold = foreground * 0.10;
        const result = Object.entries(colorCounts)
          .filter(([, count]) => count >= threshold)
          .sort(([, a], [, b]) => b - a)
          .map(([name]) => name);

        resolve(result);
      } catch {
        resolve([]);
      }
    };

    img.src = dataUrl;
  });
}
