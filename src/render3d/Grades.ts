/** Colour-grade recipes per map mood; `npm run bake` turns them into LUT images. */
export interface Grade {
  saturation: number;
  /** Strength of split toning. */
  split: number;
  shadowTint: [number, number, number];
  highTint: [number, number, number];
  /** 0 = linear, 1 = full smoothstep S-curve. */
  contrast: number;
  lift: [number, number, number];
  gain: [number, number, number];
}

export const GRADES: Record<string, Grade> = {
  // Smoky dusk: teal-leaning shadows against amber highlights, punchy mid contrast.
  ashfall: { saturation: 0.92, split: 0.09, shadowTint: [-0.25, 0.05, 0.25], highTint: [0.3, 0.12, -0.2], contrast: 0.32, lift: [0.018, 0.012, 0.016], gain: [1, 0.97, 0.92] },
  // Bleached desert noon: warm, dusty, softer contrast, milky blacks.
  veyra: { saturation: 0.84, split: 0.06, shadowTint: [0.05, 0.02, 0.12], highTint: [0.22, 0.14, -0.12], contrast: 0.2, lift: [0.045, 0.036, 0.028], gain: [1, 0.98, 0.9] },
  // Moonlit night: blue shadows, desaturated, crisp.
  khorvan: { saturation: 0.8, split: 0.12, shadowTint: [-0.2, 0.0, 0.35], highTint: [0.05, 0.08, 0.12], contrast: 0.3, lift: [0.01, 0.018, 0.035], gain: [0.94, 0.98, 1] },
  // Overcast fen dawn: muted, green in the shadows, cool pale highlights.
  mourngate: { saturation: 0.82, split: 0.1, shadowTint: [-0.12, 0.18, 0.02], highTint: [0.06, 0.12, 0.02], contrast: 0.24, lift: [0.02, 0.028, 0.02], gain: [0.96, 1, 0.94] },
  // Ember dusk: crushed warm blacks, red-orange highlights.
  cinder: { saturation: 0.78, split: 0.07, shadowTint: [0.02, -0.02, 0.16], highTint: [0.18, 0.07, -0.1], contrast: 0.3, lift: [0.02, 0.016, 0.018], gain: [1, 0.98, 0.95] },
  proving: { saturation: 0.95, split: 0.06, shadowTint: [-0.15, 0.04, 0.2], highTint: [0.22, 0.1, -0.15], contrast: 0.25, lift: [0.015, 0.012, 0.014], gain: [1, 0.98, 0.94] },
  // Humid delta morning: olive shadows, warm milky highlights, gentle contrast.
  delta: { saturation: 0.86, split: 0.09, shadowTint: [-0.08, 0.12, -0.02], highTint: [0.18, 0.12, 0.0], contrast: 0.22, lift: [0.024, 0.026, 0.018], gain: [1, 0.98, 0.9] },
  // Furnace: crushed warm blacks, deep red-orange highlights, strong contrast.
  ignis: { saturation: 0.84, split: 0.1, shadowTint: [0.06, -0.04, 0.1], highTint: [0.26, 0.08, -0.14], contrast: 0.34, lift: [0.018, 0.01, 0.012], gain: [1, 0.94, 0.88] },
  // Winter: cold blue shadows, clean white highlights, crisp.
  frost: { saturation: 0.8, split: 0.1, shadowTint: [-0.16, -0.02, 0.26], highTint: [0.02, 0.04, 0.1], contrast: 0.26, lift: [0.02, 0.024, 0.036], gain: [0.96, 0.99, 1] },
};
