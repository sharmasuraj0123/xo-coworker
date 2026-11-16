/**
 * Backdrop context contract for createSurfaces. The browser does not expose
 * composited page pixels to script, so the HOST describes what is behind a
 * surface; this module decides, deterministically, what the material does
 * with that description. Pure functions; unit-tested under Node.
 *
 * context = { luminance: 0–1 relative luminance of the backdrop,
 *             density:   0–1 how busy it is (text, fine detail); default 0,
 *             color:     optional sRGB triple; used for luminance if omitted }
 */
import { luminance as relativeLuminance } from './optics.js';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
/** Bounds that keep an adapted surface a refracting material, not a blur panel. */
export const PROTECTION_LIMITS = Object.freeze({ tintBoost: 0.3, tintCeiling: 0.72, blurBoost: 8 });
/** Polarity thresholds with hysteresis: go dark below .24, return to light above .43. */
export const POLARITY = Object.freeze({ toDark: 0.24, toLight: 0.43 });

/** Returns a clean context, or null when the input cannot be used. */
export function normalizeContext(input) {
  if (!input || typeof input !== 'object') return null;
  const color = Array.isArray(input.color) && input.color.length >= 3 && input.color.slice(0, 3).every(Number.isFinite)
    ? input.color.slice(0, 3).map(channel => clamp(channel, 0, 255)) : null;
  const value = Number.isFinite(input.luminance) ? input.luminance : color ? relativeLuminance(color) : null;
  if (value === null) return null;
  return { luminance: clamp(value), density: Number.isFinite(input.density) ? clamp(input.density) : 0, color };
}

/**
 * Small surfaces follow the backdrop with hysteresis so they cannot flicker at
 * a boundary. Large surfaces keep the polarity the host authored.
 */
export function resolveAppearance(context, previous, { large = false, authored = 'light' } = {}) {
  if (large || !context) return large ? authored : previous || authored;
  const current = previous || authored;
  if (current === 'dark') return context.luminance > POLARITY.toLight ? 'light' : 'dark';
  return context.luminance < POLARITY.toDark ? 'dark' : 'light';
}

/**
 * How much foreground protection the backdrop calls for (0–1), and the bounded
 * tint and diffusion that provide it. Shoulder, displacement and reflection are
 * never changed here: readability is not bought by flattening the lens.
 */
export function protect(material, context, appearance = 'light') {
  if (!context) return { tint: material.tint, blur: material.blur, protection: 0 };
  // Conflict: a light surface (dark foreground) over a dark backdrop, or the reverse.
  const conflict = appearance === 'dark'
    ? clamp((context.luminance - 0.45) / 0.55) : clamp((0.55 - context.luminance) / 0.55);
  const protection = clamp(Math.max(context.density * 0.85, conflict));
  const tint = Math.max(material.tint,
    Math.min(PROTECTION_LIMITS.tintCeiling, material.tint + PROTECTION_LIMITS.tintBoost * protection));
  const blur = material.blur + PROTECTION_LIMITS.blurBoost * clamp(context.density);
  return { tint, blur, protection };
}
