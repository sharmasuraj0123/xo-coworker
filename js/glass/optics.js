/** Shared geometry for refraction and illumination. These are our optical
 * approximations, not Apple's private material equations. */
export const clamp = (v, low = 0, high = 1) => Math.max(low, Math.min(high, v));
export function smoothstep(a, b, v) {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export function surfaceAt(
  x,
  y,
  {
    width,
    height,
    radius,
    bevel,
    heightRatio = 0.55,
    ior = 1.5,
    refractiveGain = 3.2,
    shoulderExponent = 4,
  },
) {
  const px = x - width / 2,
    py = y - height / 2;
  const qx = Math.abs(px) - (width / 2 - radius),
    qy = Math.abs(py) - (height / 2 - radius);
  const ox = Math.max(qx, 0),
    oy = Math.max(qy, 0),
    length = Math.hypot(ox, oy);
  const distance = radius - length - Math.min(Math.max(qx, qy), 0);
  const gx = length ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
  const gy = length ? (oy / length) * Math.sign(py) : qy >= qx ? Math.sign(py) : 0;
  // Height is exactly zero outside the silhouette. The old .001 height clamp
  // produced an artificial finite-thickness step at the optical boundary.
  if (distance <= 0) return { distance, height: 0, nx: gx, ny: gy, nz: 0, dx: 0, dy: 0 };
  const t = clamp(distance / bevel),
    profile = (1 - (1 - t) ** shoulderExponent) ** (1 / shoulderExponent);
  const opticalHeight = bevel * heightRatio * profile;
  // The derivative and the optical height now describe the SAME surface.
  const slope =
    (heightRatio * (1 - t) ** (shoulderExponent - 1)) /
    Math.max(profile ** (shoulderExponent - 1), 1e-12);
  const nz = 1 / Math.hypot(slope, 1),
    nx = gx * slope * nz,
    ny = gy * slope * nz;
  const eta = 1 / ior,
    k = eta * nz - Math.sqrt(1 - eta * eta * (1 - nz * nz));
  const rz = -eta + k * nz,
    travel = opticalHeight / -rz;
  return {
    distance,
    height: opticalHeight,
    nx,
    ny,
    nz,
    dx: k * nx * travel * refractiveGain,
    dy: k * ny * travel * refractiveGain,
  };
}
export function fresnel(cosine, ior = 1.5) {
  const f0 = ((ior - 1) / (ior + 1)) ** 2;
  return f0 + (1 - f0) * (1 - clamp(cosine)) ** 5;
}
/** Reflected viewing ray samples two broad virtual light sources. Reflection
 * physics and artistic exposure are separate; CSS composition is display-space. */
export function reflectedLight(normal, lightX = -0.45, lightY = -0.65, ior = 1.5) {
  const { nx, ny, nz } = normal;
  const rx = 2 * nx * nz,
    ry = 2 * ny * nz,
    rz = 2 * nz * nz - 1;
  const length = Math.hypot(lightX, lightY, 1.15);
  const key = Math.exp(
    ((rx * lightX) / length + (ry * lightY) / length + (rz * 1.15) / length - 1) / 0.065,
  );
  const bounceLength = Math.hypot(0.45, 0.65, 0.7);
  const bounce = Math.exp(
    ((rx * 0.45) / bounceLength + (ry * 0.65) / bounceLength + (rz * 0.7) / bounceLength - 1) /
      0.095,
  );
  return { fresnel: fresnel(nz, ior), key, bounce };
}
export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = clamp(v / 255);
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
/** Hysteresis prevents a small surface flickering at a scene boundary. */
export function appearanceFor(sample, previous = 'light', large = false, preferred = 'light') {
  if (large) return preferred;
  const l = clamp(sample.luminance);
  return previous === 'dark' ? (l > 0.43 ? 'light' : 'dark') : l < 0.24 ? 'dark' : 'light';
}
