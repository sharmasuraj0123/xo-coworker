/**
 * Surface geometry adapted from Liqui Design's LiquiGlass.tsx.
 * Copyright (c) 2026 Fan Li. SPDX-License-Identifier: MIT
 * License: ./LICENSE-liqui-design.txt
 * Source: https://github.com/leefanv/liqui-design/blob/13ca7af2c7212dbaba0420ecf381dbc8b6397c0e/packages/glass/src/LiquiGlass.tsx
 *
 * Ported here without React, canvas or browser dependencies. Changes: expose
 * normalized displacement separately from pixel strength, interpolate the
 * profile lookup table, make displacement exactly zero at the outer boundary,
 * and default to circular corners to match this app's CSS clipping. The height
 * profile called "squircle" is independent of the optional squircle OUTLINE.
 */

const LUT_SIZE = 128;
const profiles = new Map();
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

/** The original Snell-inspired normalized shoulder, not Apple's private optics. */
function surfaceLUTs(profile) {
  if (profiles.has(profile)) return profiles.get(profile);
  const magnitude = new Float32Array(LUT_SIZE);
  const slope = new Float32Array(LUT_SIZE);
  const refractiveIndex = 1.5;
  const thickness = 0.6;
  const height = profile === 'convex'
    ? t => Math.sqrt(1 - (1 - t) * (1 - t))
    : t => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
  const epsilon = 1 / 1024;
  let peak = 0;
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = Math.max(i / (LUT_SIZE - 1), epsilon);
    const hi = Math.min(t + epsilon, 1);
    const lo = Math.max(t - epsilon, 0);
    slope[i] = (height(hi) - height(lo)) / (hi - lo) * thickness;
    const incident = Math.atan(Math.abs(slope[i]));
    const bend = incident - Math.asin(Math.sin(incident) / refractiveIndex);
    magnitude[i] = i === 0 ? 0 : height(t) * thickness * Math.tan(bend);
    peak = Math.max(peak, magnitude[i]);
  }
  if (peak > 0) for (let i = 0; i < LUT_SIZE; i++) magnitude[i] /= peak;
  // The interior is flat; finite differences otherwise leave a small residual.
  magnitude[LUT_SIZE - 1] = 0;
  slope[LUT_SIZE - 1] = 0;
  const result = { magnitude, slope };
  profiles.set(profile, result);
  return result;
}

/**
 * Signed outline field adapted from Liqui's surfaceField. sd is negative inside.
 * Squircle distance is a first-order approximation, accurate at the boundary;
 * round distance is exact. Both share the same outward-normal convention.
 */
function surfaceField(px, py, bx, by, radius, round) {
  const qx = Math.abs(px) - bx;
  const qy = Math.abs(py) - by;
  if (round && qx > 0 && qy > 0) {
    const length = Math.hypot(qx, qy) || 1;
    return {
      sd: length - radius,
      nx: Math.sign(px) * qx / length,
      ny: Math.sign(py) * qy / length,
    };
  }
  if (!round && qx > 0 && qy > 0) {
    const x3 = qx * qx * qx;
    const y3 = qy * qy * qy;
    const q = Math.pow(qx * x3 + qy * y3, 0.25);
    const length = Math.hypot(x3, y3) || 1;
    return {
      sd: (q - radius) * q * q * q / length,
      nx: Math.sign(px) * x3 / length,
      ny: Math.sign(py) * y3 / length,
    };
  }
  return {
    sd: Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
      + Math.min(Math.max(qx, qy), 0) - radius,
    nx: qx > qy ? Math.sign(px) : 0,
    ny: qx > qy ? 0 : Math.sign(py),
  };
}

/**
 * @param {number} x CSS-pixel coordinate from the element's left edge.
 * @param {number} y CSS-pixel coordinate from the element's top edge.
 * @param {{width:number,height:number,radius:number,bezel:number,
 *   profile?:'squircle'|'convex',corner?:'round'|'squircle'}} geometry
 * @returns {{distance:number,nx:number,ny:number,dx:number,dy:number,
 *   magnitude:number,slope:number}}
 * distance is positive inside. nx/ny are outward unit-outline normals.
 * dx/dy are INWARD sampling offsets normalized to peak magnitude 1. Multiply
 * them by a chosen peakDisplacement in CSS px; SVG scale is twice that peak
 * when packing the components as 0.5 + component * 0.5. Never normalize again.
 * Use corner:'squircle' only when the CSS clip uses the same corner geometry.
 */
export function sampleSurface(x, y, {
  width, height, radius, bezel, profile = 'squircle', corner = 'round',
}) {
  const half = Math.min(width, height) / 2;
  const r = clamp(radius, 0, half);
  const round = corner !== 'squircle' || r >= half - 0.5;
  const field = surfaceField(x - width / 2, y - height / 2,
    width / 2 - r, height / 2 - r, r, round);
  const distance = -field.sd;
  let magnitude = 0;
  let slope = 0;
  if (bezel > 0 && distance > 0 && distance < bezel) {
    const table = surfaceLUTs(profile === 'convex' ? 'convex' : 'squircle');
    const index = clamp(distance / bezel) * (LUT_SIZE - 1);
    const lower = Math.floor(index);
    const upper = Math.min(lower + 1, LUT_SIZE - 1);
    const fraction = index - lower;
    magnitude = table.magnitude[lower]
      + (table.magnitude[upper] - table.magnitude[lower]) * fraction;
    slope = table.slope[lower] + (table.slope[upper] - table.slope[lower]) * fraction;
  }
  return {
    distance,
    nx: field.nx,
    ny: field.ny,
    dx: -field.nx * magnitude,
    dy: -field.ny * magnitude,
    magnitude,
    slope,
  };
}

/**
 * Displacement field of one top-left corner in normalized units, where the
 * corner extent c = max(radius, shoulder) spans `pixels` samples. `margin`
 * extra samples continue past c, where the field is the straight-edge profile
 * (x direction) or neutral (interior). Scale invariance of sampleSurface lets
 * every surface with the same radius/c and shoulder/c ratios share one tile.
 * @returns {{size:number, dx:Float32Array, dy:Float32Array}}
 */
export function cornerTile(pixels, margin, radiusRatio, shoulderRatio) {
  const size = pixels + margin;
  const dx = new Float32Array(size * size), dy = new Float32Array(size * size);
  const geometry = { width: 4, height: 4, radius: radiusRatio, bezel: shoulderRatio };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = sampleSurface((x + 0.5) / pixels, (y + 0.5) / pixels, geometry);
    dx[y * size + x] = p.dx; dy[y * size + x] = p.dy;
  }
  return { size, dx, dy };
}
