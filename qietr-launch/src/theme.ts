/* =============================================================================
 * theme.ts — design tokens mirrored verbatim from qietr-web/app/globals.css.
 *
 * Light theme only. No gradients, no glows, no dark backgrounds.
 * The film inherits the product's exact palette so it is brand-correct by
 * construction.
 * ============================================================================= */

import { Easing } from "remotion";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const COLORS = {
  ground: "#FFFFFF",
  surface1: "#F7F7F5",
  surface2: "#EDEDE8",
  ink: "#0E0E0C",
  inkSecondary: "#5B5B57",
  grid: "#E2E2DC",
  strong: "#1A1A1A",
  accentPressed: "#000000",
} as const;

/* ----------------------------------------------------------------------------
 * Fonts. loadFont() blocks rendering until the font is ready.
 * -------------------------------------------------------------------------- */
export const interTight = loadInterTight("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
}).fontFamily;

export const inter = loadInter("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
}).fontFamily;

export const mono = loadMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
}).fontFamily;

/* ----------------------------------------------------------------------------
 * Easing — three curves for the whole film.
 *   out   : entrances + settles (strong ease-out, no overshoot)
 *   inOut : line draws + travels
 *   in    : exits + retractions
 * -------------------------------------------------------------------------- */
export const EASE = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.83, 0, 0.17, 1),
  in: Easing.bezier(0.55, 0.085, 0.68, 0.53),
} as const;

/* ----------------------------------------------------------------------------
 * Type scale (px @ 4K / 3840x2160).
 * -------------------------------------------------------------------------- */
export const TYPE = {
  hero: 132, // S1-3 statements
  principle: 200, // S6 single words
  kicker: 44, // "Introducing"
  tagline: 104, // S8
  caption: 40, // station labels
  mono: 36, // hash / amount / url / 402
} as const;

/* ----------------------------------------------------------------------------
 * Layout constants @ 4K.
 * -------------------------------------------------------------------------- */
export const W = 3840;
export const H = 2160;
export const MARGIN = 160;
export const GRID_CELL = 192;
export const STROKE = { line: 4, active: 6, ring: 8 } as const;
export const FPS = 30;

/* ----------------------------------------------------------------------------
 * Deterministic PRNG (mulberry32). Seeded so every render is identical —
 * required for review and for re-rendering at other resolutions.
 * -------------------------------------------------------------------------- */
export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
