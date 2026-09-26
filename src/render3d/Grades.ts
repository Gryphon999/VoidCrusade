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
  proving: { saturation: 0.95, split: 0.06, shadowTint: [-0.15, 0.04, 0.2], highTint: [0.22, 0.1, -0.15], contrast: 0.25, lift: [0.015, 0.012, 0.014], gain: [1, 0.98, 0.94] },
};
