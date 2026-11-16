/** Material recipe contract for createSurfaces: merging and validation. Pure
 * functions with no DOM access, so the contract is unit-tested under Node. */

/** Inclusive numeric ranges. Values outside are clamped; non-finite values are rejected. */
export const MATERIAL_LIMITS = Object.freeze({
  shoulder: [0, 200], displacement: [0, 100], blur: [0, 100], tint: [0, 1],
  dispersion: [0, 2], reflection: [0, 1],
});
export const LIGHTING_LIMITS = Object.freeze({
  highlightStrength: [0, 2], edgeStrength: [0, 1], bounceStrength: [0, 2],
});
const COLORS = ['edgeColor', 'bounceColor'];

/**
 * Merge recipe layers left to right. `lighting` merges field by field, so a
 * partial lighting update keeps the fields it does not mention. `undefined`
 * leaves the earlier value; `null` removes an override and restores the value
 * from the layers before it (ultimately the preset).
 */
export function mergeMaterial(...layers) {
  const result = {};
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined) continue;
      if (key === 'lighting') {
        if (value === null) delete result.lighting;
        else if (typeof value === 'object') {
          const lighting = { ...result.lighting };
          for (const [name, entry] of Object.entries(value)) {
            if (entry === null) delete lighting[name];
            else if (entry !== undefined) lighting[name] = entry;
          }
          result.lighting = lighting;
        } else result.lighting = value;
      } else if (value === null) delete result[key];
      else result[key] = value;
    }
  }
  return result;
}

const color = value => Array.isArray(value) && value.length >= 3
  && value.slice(0, 3).every(Number.isFinite)
  ? value.slice(0, 3).map(channel => Math.round(Math.max(0, Math.min(255, channel))))
  : null;

/**
 * Return a recipe in which every field is finite and inside its range.
 * An invalid field takes the corresponding `fallback` (preset) value and is
 * reported through `report(path, value)`; it never reaches CSS or the filter.
 */
export function normalizeMaterial(material, fallback = {}, report = () => {}) {
  const result = {};
  const number = (value, [low, high], spare, path) => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(low, Math.min(high, value));
    if (value !== undefined) report(path, value);
    return typeof spare === 'number' && Number.isFinite(spare) ? Math.max(low, Math.min(high, spare)) : undefined;
  };
  for (const [key, range] of Object.entries(MATERIAL_LIMITS)) {
    const value = number(material?.[key], range, fallback[key], `material.${key}`);
    if (value !== undefined) result[key] = value;
  }
  const source = material?.lighting, spare = fallback.lighting || {};
  if (source !== undefined && (source === null || typeof source !== 'object' || Array.isArray(source))) {
    report('material.lighting', source);
  }
  const lighting = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const cleaned = {};
  for (const [key, range] of Object.entries(LIGHTING_LIMITS)) {
    const value = number(lighting[key], range, spare[key], `material.lighting.${key}`);
    if (value !== undefined) cleaned[key] = value;
  }
  for (const key of COLORS) {
    const value = color(lighting[key]);
    if (value) cleaned[key] = value;
    else {
      if (lighting[key] !== undefined) report(`material.lighting.${key}`, lighting[key]);
      const previous = color(spare[key]);
      if (previous) cleaned[key] = previous;
    }
  }
  result.lighting = cleaned;
  return result;
}
