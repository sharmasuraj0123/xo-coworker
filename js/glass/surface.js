/** Experimental application material. A wider optical shoulder and an explicit
 * pixel displacement keep transmission independent of reflection and tint.
 * Profile/shape math is adapted from MIT-licensed Liqui Design in surface-optics.js.
 * Research and attribution: docs/research/web-reference-study.md. */
import { clamp } from './optics.js';
import { sampleSurface, cornerTile } from './surface-optics.js';
import { mergeMaterial, normalizeMaterial } from './surface-material.js';
import { normalizeContext, resolveAppearance, protect } from './surface-context.js';
const LARGE_KINDS = new Set(['sidebar', 'panel']);

const NS = 'http://www.w3.org/2000/svg';
export const SURFACE_PRESETS = Object.freeze({
  control: { shoulder: 10, displacement: 5, blur: 1.5, tint: 0.18 },
  composer: { shoulder: 19, displacement: 12, blur: 2, tint: 0.2 },
  sidebar: { shoulder: 22, displacement: 11, blur: 12, tint: 0.35 },
  panel: { shoulder: 18, displacement: 9, blur: 12, tint: 0.6 },
  media: { shoulder: 28, displacement: 21, blur: 0.7, tint: 0.045, dispersion: 0.6, reflection: 1 },
  ink: { shoulder: 17, displacement: 11, blur: 9, tint: 0.38, reflection: 0.85 },
  lens: { shoulder: 23, displacement: 16, blur: 1.2, tint: 0.06, dispersion: 0.35, reflection: 1 },
  notice: { shoulder: 17, displacement: 9, blur: 10, tint: 0.13, reflection: 0.95 },
});
Object.values(SURFACE_PRESETS).forEach(Object.freeze);
const presets = SURFACE_PRESETS;
// Displacement is assembled from shared tiles: four corners and four edge
// profiles, placed by SVG filter primitives. A tile set depends only on the
// ratios radius/c and shoulder/c (c = corner extent) and a resolution bucket,
// so surfaces of any size reuse it and a size change only moves primitives.
const TILE_BUCKETS = [16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];
const TILE_MARGIN = 2, RATIO_STEPS = 128, BAND = 7;
const tileSets = new Map();
function tileSet(radiusRatio, shoulderRatio, needed) {
  const pixels = TILE_BUCKETS.find(bucket => bucket >= needed) || TILE_BUCKETS.at(-1);
  const rq = Math.round(clamp(radiusRatio) * RATIO_STEPS) / RATIO_STEPS;
  const sq = Math.max(1, Math.round(clamp(shoulderRatio) * RATIO_STEPS)) / RATIO_STEPS;
  const key = `${rq}:${sq}:${pixels}`;
  let set = tileSets.get(key);
  if (set) { tileSets.delete(key); tileSets.set(key, set); return set; }
  const { size, dx, dy } = cornerTile(pixels, TILE_MARGIN, rq, sq);
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  const last = size - 1, at = (x, y) => y * size + x;
  const encode = (width, height, sample) => {
    canvas.width = width; canvas.height = height;
    const image = context.createImageData(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4, [vx, vy] = sample(x, y);
      // An exactly neutral 128 is recovered as 0.5 by the SVG transfer.
      image.data[offset] = Math.round(128 + vx * 127);
      image.data[offset + 1] = Math.round(128 + vy * 127);
      image.data[offset + 2] = 128; image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  };
  const urls = [
    // Straight edges: top, bottom, left, right. Two samples wide; stretched along the edge.
    encode(2, size, (x, y) => [0, dy[at(last, y)]]),
    encode(2, size, (x, y) => [0, -dy[at(last, last - y)]]),
    encode(size, 2, (x, y) => [dx[at(x, last)], 0]),
    encode(size, 2, (x, y) => [-dx[at(last - x, last)], 0]),
    // Corners: top-left, top-right, bottom-left, bottom-right (mirrored).
    encode(size, size, (x, y) => [dx[at(x, y)], dy[at(x, y)]]),
    encode(size, size, (x, y) => [-dx[at(last - x, y)], dy[at(last - x, y)]]),
    encode(size, size, (x, y) => [dx[at(x, last - y)], -dy[at(x, last - y)]]),
    encode(size, size, (x, y) => [-dx[at(last - x, last - y)], -dy[at(last - x, last - y)]]),
  ];
  set = { key, pixels, urls, decoded: false, ready: null };
  set.ready = Promise.all(urls.map(url => { const image = new Image(); image.src = url; return image.decode(); }))
    .then(() => { set.decoded = true; });
  tileSets.set(key, set);
  while (tileSets.size > 48) tileSets.delete(tileSets.keys().next().value);
  return set;
}
/**
 * Reflection samples for the lit band inside the outline, as flat typed arrays
 * grouped into four corner blocks and up to four edge strips. Cost follows the
 * perimeter band; only corner blocks grow with the radius. Cached for repeated geometry.
 */
const bandCache = new Map();
function edgeBand(width, height, radius, scale, pixelWidth, pixelHeight) {
  const key = [width, height, radius, scale].join(':');
  let band = bandCache.get(key);
  if (band) { bandCache.delete(key); bandCache.set(key, band); return band; }
  const depth = Math.ceil(BAND * scale) + 1;
  // The band hugs the outline, so along a rounded corner it leaves the thin
  // edge strips: at 45 degrees it sits about 0.29 * radius from both edges.
  // Corners therefore get a full radius-sized block and only the straight runs
  // between them use strips. The rectangles partition the canvas, never overlap.
  const reach = Math.max(depth, Math.ceil(radius * scale) + 1);
  const cx = Math.min(reach, pixelWidth >> 1), cy = Math.min(reach, pixelHeight >> 1);
  const midX = pixelWidth - cx * 2, midY = pixelHeight - cy * 2;
  const dx = Math.min(depth, cx), dy = Math.min(depth, cy);
  const rects = [
    [0, 0, cx, cy], [pixelWidth - cx, 0, cx, cy], [0, pixelHeight - cy, cx, cy], [pixelWidth - cx, pixelHeight - cy, cx, cy],
    [cx, 0, midX, dy], [cx, pixelHeight - dy, midX, dy], [0, cy, dx, midY], [pixelWidth - dx, cy, dx, midY],
  ].filter(rect => rect[2] > 0 && rect[3] > 0);
  const geometry = { width, height, radius, bezel: 1 };
  const strips = rects.map(([x0, y0, w, h]) => {
    const offsets = [], values = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = (x0 + x + 0.5) * width / pixelWidth, py = (y0 + y + 0.5) * height / pixelHeight;
      const p = sampleSurface(px, py, geometry);
      if (p.distance > -0.5 / scale && p.distance < BAND) { offsets.push((y * w + x) * 4); values.push(p.nx, p.ny, p.distance, px); }
    }
    return { x: x0, y: y0, width: w, height: h, offsets: Int32Array.from(offsets), values: Float32Array.from(values) };
  });
  band = { strips, samples: strips.reduce((sum, strip) => sum + strip.offsets.length, 0) };
  bandCache.set(key, band);
  while (bandCache.size > 24) bandCache.delete(bandCache.keys().next().value);
  return band;
}
let nextID = 0;
// One manager owns an element. Shared by every manager created from this module.
const owners = new WeakMap();
/**
 * Resolve the used corner radius the way CSS does: percentages against their
 * own axis, then clamped so adjacent corners cannot overlap. A zero radius is a
 * real square corner, not a missing value. `uniform` is false for elliptical or
 * unequal corners, which the rounded-rectangle field cannot represent.
 */
export function cornerRadius(style, width, height) {
  const corners = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
    .map(name => {
      const parts = String(style[name] || '0px').trim().split(/\s+/);
      const resolve = (part, axis) => {
        const value = parseFloat(part);
        if (!Number.isFinite(value) || value < 0) return 0;
        return part.endsWith('%') ? axis * value / 100 : value;
      };
      return [resolve(parts[0], width), resolve(parts[1] ?? parts[0], height)];
    });
  const [tl, tr, br, bl] = corners;
  const fit = (extent, a, b) => (a + b > extent && a + b > 0 ? extent / (a + b) : 1);
  const factor = Math.min(1, fit(width, tl[0], tr[0]), fit(width, bl[0], br[0]),
    fit(height, tl[1], bl[1]), fit(height, tr[1], br[1]));
  const radii = corners.flat().map(value => value * factor);
  const radius = Math.max(0, Math.min(...radii, width / 2, height / 2));
  return { radius, uniform: radii.every(value => Math.abs(value - radius) < 0.01) };
}
const svg = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};

/** One owner per app. Native controls remain in the DOM and retain semantics. */
export function createSurfaces({ root = document, renderer = 'auto', materials = {}, sampleBackdrop = null, backdrop = null } = {}) {
  const states = new Map();
  const controller = new AbortController();
  const { signal } = controller;
  // Live-DOM displacement needs backdrop-filter to accept an SVG filter reference
  // AND to render it. CSS.supports() only proves parsing: Firefox and WebKit
  // accept the syntax and draw nothing (measured: docs/guide/browser-support.md), and script
  // cannot read backdrop pixels to test rendering. The engine check therefore
  // stays, using UA-CH brands where available. 'refractive' skips it for a host
  // that has verified its own engine.
  const chromium = navigator.userAgentData?.brands?.some(entry => entry.brand === 'Chromium')
    ?? /(?:Chrome|Chromium)\//.test(navigator.userAgent);
  const supportsRefraction = renderer === 'refractive'
    || (renderer !== 'css' && chromium && CSS.supports('backdrop-filter', 'url("#surface")'));
  // Where the backdrop filter cannot refract, a surface whose host names its
  // backdrop is rendered by mirroring that backdrop into the surface and
  // displacing the copy with an ordinary element filter (measured in Firefox:
  // docs/guide/browser-support.md). An ancestor's CSS background is copied; any other element
  // needs a live element image, which only Gecko provides.
  // Automatic selection is limited to Gecko, where this was measured to render
  // correctly. WebKitGTK 2.54 draws the filtered copy wrongly, so it keeps the
  // CSS path unless a host forces renderer: 'mirror' after its own testing.
  const elementImage = CSS.supports('background-image', '-moz-element(#surface)');
  const mirrorCapable = renderer === 'mirror' || (renderer === 'auto' && !supportsRefraction && elementImage);
  const mirrors = new Set();
  let mirrorFrame = 0, backdropIDs = 0;
  const definitions = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
  definitions.classList.add('surface-definitions');
  const defs = svg('defs');
  definitions.append(defs);
  document.body.append(definitions);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const dirtyLights = new Set();
  let pending = 0;
  let destroyed = false;
  const warned = new Set();
  const report = (path, value) => {
    if (warned.has(path)) return;
    warned.add(path);
    console.warn(`[liquid-glass] Ignored invalid ${path} (${String(value)}); using the preset value.`);
  };
  /** Preset → manager `materials` → per-surface `material`, validated once per change. */
  function resolve(state) {
    const base = presets[state.kind] || presets.control;
    return normalizeMaterial(mergeMaterial(base, materials[state.kind], state.options.material), base, report);
  }
  function queueLight(state) {
    dirtyLights.add(state);
    if (!pending) pending = requestAnimationFrame(() => {
      pending = 0;
      for (const item of dirtyLights) if (states.get(item.el) === item) paint(item);
      dirtyLights.clear();
    });
  }
  function resetLight(state) {
    const changed = state.lightX !== 0;
    state.lightX = 0;
    state.el.style.setProperty('--surface-x', '50%');
    state.el.style.setProperty('--surface-y', '50%');
    if (changed) queueLight(state);
  }
  function clearPress(state) {
    state.pointer = null;
    state.pressedKey = null;
    state.el.removeAttribute('data-surface-pressed');
  }
  function applyMaterial(state) {
    const preset = state.material = resolve(state);
    state.el.dataset.surface = state.kind;
    if (preset.reflection !== undefined) state.el.style.setProperty('--surface-reflection-opacity', preset.reflection);
    else state.el.style.removeProperty('--surface-reflection-opacity');
    const appearance = state.options.appearance;
    const authored = state.attributes.get('data-surface-appearance');
    const large = (state.options.size || (LARGE_KINDS.has(state.kind) ? 'large' : 'small')) === 'large';
    if (appearance === 'light' || appearance === 'dark') state.el.dataset.surfaceAppearance = appearance;
    else if (appearance === 'auto') {
      // Opt-in polarity: small surfaces follow the host's context with hysteresis.
      state.appearance = resolveAppearance(state.backdrop, state.appearance, { large, authored: authored === 'dark' ? 'dark' : 'light' });
      if (state.el.dataset.surfaceAppearance !== state.appearance) state.el.dataset.surfaceAppearance = state.appearance;
    } else if (appearance !== undefined) {
      // An explicit null/invalid value returns the element to what the host authored.
      if (authored === null) state.el.removeAttribute('data-surface-appearance');
      else state.el.dataset.surfaceAppearance = authored;
    }
    const look = state.el.dataset.surfaceAppearance
      || (state.el.closest('[data-theme="dark"]') ? 'dark' : 'light');
    const adapted = state.adapted = protect(preset, state.backdrop, look);
    // A small deadband keeps a slowly changing backdrop from restyling every frame.
    if (state.shownTint === undefined || Math.abs(state.shownTint - adapted.tint) > 0.012 || !state.backdrop) {
      state.shownTint = adapted.tint; state.el.style.setProperty('--surface-tint', +adapted.tint.toFixed(4));
    }
    if (state.shownBlur === undefined || Math.abs(state.shownBlur - adapted.blur) > 0.25 || !state.backdrop) {
      state.shownBlur = adapted.blur; state.el.style.setProperty('--surface-blur', `${+adapted.blur.toFixed(3)}px`);
    }
  }
  /** Explicit setContext() wins; otherwise ask the manager's sampler, if any. */
  function sample(state) {
    if (state.pushed !== undefined || !sampleBackdrop) return false;
    let next = null;
    try { next = normalizeContext(sampleBackdrop(state.el.getBoundingClientRect(), state.el)); }
    catch (error) { report('sampleBackdrop() result', error?.message || error); }
    const before = state.backdrop;
    state.backdrop = next;
    return before?.luminance !== next?.luminance || before?.density !== next?.density;
  }

  function paint(state) {
    const { width, scale, context, band, lightX } = state;
    if (!band) return;
    const lighting = state.material.lighting;
    const highlightStrength = lighting.highlightStrength ?? 1;
    const edgeStrength = lighting.edgeStrength ?? 0;
    const edgeColor = lighting.edgeColor || [45, 57, 76];
    const bounceStrength = lighting.bounceStrength ?? 0.23;
    const bounceColor = lighting.bounceColor || [255, 255, 255];
    const lx = -0.48 + lightX * 0.25, ly = -0.85;
    const highlightDepth = edgeStrength ? state.shoulder * 0.11 : 0.8;
    const highlightWidth = edgeStrength ? state.shoulder * 0.05 : 0.62;
    state.images.forEach((image, index) => {
      const strip = band.strips[index], { offsets, values } = strip, data = image.data;
      data.fill(0);
      for (let i = 0, v = 0; i < offsets.length; i++, v += 4) {
        const nx = values[v], ny = values[v + 1], distance = values[v + 2], x = values[v + 3], offset = offsets[i];
        const facing = (nx * lx + ny * ly) / (Math.hypot(nx, ny) || 1);
        // Reflections occupy short, illuminated arcs; the whole contour is never stroked.
        const key = Math.max(0, facing) ** 2;
        const bounce = Math.max(0, -facing) ** 5 * bounceStrength;
        const coverage = clamp(distance * scale + 0.5);
        const narrow = Math.exp(-(((distance - highlightDepth) / highlightWidth) ** 2));
        const soft = Math.exp(-(((distance - 2) / 1.7) ** 2)) * 0.11;
        const footprint = 0.65 + 0.35 * Math.cos((x / width - 0.25) * Math.PI);
        const light = (key + bounce) * (narrow * 0.66 + soft) * footprint * highlightStrength;
        const shade = Math.max(0, -facing) ** 2 * Math.exp(-(((distance - 1.5) / 1.1) ** 2)) * 0.085;
        // Directional absorption at the outer shoulder, followed by its inner
        // reflection. Both follow the shared normal field, never a CSS stroke.
        const absorption = edgeStrength * key * Math.exp(-(((distance - 0.35) / 0.5) ** 2));
        const value = light - shade - absorption;
        const bounceMix = bounce / (key + bounce || 1);
        data[offset] = value >= 0 ? 255 + (bounceColor[0] - 255) * bounceMix : edgeColor[0];
        data[offset + 1] = value >= 0 ? 255 + (bounceColor[1] - 255) * bounceMix : edgeColor[1];
        data[offset + 2] = value >= 0 ? 255 + (bounceColor[2] - 255) * bounceMix : edgeColor[2];
        data[offset + 3] = Math.round(Math.abs(value) * coverage * 255);
      }
      context.putImageData(image, strip.x, strip.y);
    });
  }

  /** The per-surface filter is created once; geometry changes only move primitives. */
  function createFilter(state) {
    const filter = svg('filter', { id: `liquid-surface-${++nextID}`, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    filter.append(svg('feFlood', { 'flood-color': 'rgb(128,128,128)', result: 'flat' }));
    const merge = svg('feMerge', { result: 'map' });
    merge.append(svg('feMergeNode', { in: 'flat' }));
    state.tileNodes = Array.from({ length: 8 }, (_, index) => {
      const node = svg('feImage', { preserveAspectRatio: 'none', result: `tile${index}` });
      filter.append(node); merge.append(svg('feMergeNode', { in: `tile${index}` }));
      return node;
    });
    const neutral = svg('feComponentTransfer', { in: 'map', result: 'neutralMap' });
    ['R', 'G'].forEach(channel => neutral.append(svg(`feFunc${channel}`, { type: 'linear', slope: 255 / 254, intercept: -1 / 254 })));
    filter.append(merge, neutral);
    state.filter = filter; state.displacers = []; state.dispersive = null; state.tiles = null;
    defs.append(filter);
  }
  function layoutFilter(state, set) {
    const { width, height, corner, displacement, filter } = state;
    const dispersion = state.material.dispersion || 0;
    if (state.dispersive !== dispersion > 0) {
      state.displacers.forEach(node => node.remove());
      const add = (name, attrs) => { const node = svg(name, attrs); filter.append(node); state.displacers.push(node); return node; };
      state.displacers = []; state.dispersive = dispersion > 0;
      const displace = result => add('feDisplacementMap', { in: 'SourceGraphic', in2: 'neutralMap', xChannelSelector: 'R', yChannelSelector: 'G', ...(result ? { result } : {}) });
      if (state.dispersive) {
        // Real channel-separated sampling, not a painted rainbow on the rim.
        state.maps = ['R', 'G', 'B'].map((channel, index) => {
          const map = displace(`refract${channel}`);
          const matrix = Array(20).fill(0);
          matrix[index * 5 + index] = 1; matrix[18] = 1;
          add('feColorMatrix', { in: `refract${channel}`, type: 'matrix', values: matrix.join(' '), result: `channel${channel}` });
          return map;
        });
        add('feBlend', { in: 'channelR', in2: 'channelG', mode: 'screen', result: 'redGreen' });
        add('feBlend', { in: 'redGreen', in2: 'channelB', mode: 'screen' });
      } else state.maps = [displace()];
    }
    state.maps.forEach((map, index) => map.setAttribute('scale',
      (state.dispersive ? displacement + (1 - index) * dispersion : displacement) * 2));
    const set4 = (node, x, y, w, h) => { node.setAttribute('x', x); node.setAttribute('y', y); node.setAttribute('width', Math.max(w, 0.01)); node.setAttribute('height', Math.max(h, 0.01)); };
    set4(filter, -displacement * 2, -displacement * 2, width + displacement * 4, height + displacement * 4);
    // Tiles extend TILE_MARGIN samples past the corner; edges run one sample
    // under the corners, so antialiased tile borders only ever blend equal values.
    const tile = corner * (set.pixels + TILE_MARGIN) / set.pixels, overlap = corner / set.pixels;
    const along = [corner - overlap, width - corner * 2 + overlap * 2], down = [corner - overlap, height - corner * 2 + overlap * 2];
    const rects = [
      [along[0], 0, along[1], tile], [along[0], height - tile, along[1], tile],
      [0, down[0], tile, down[1]], [width - tile, down[0], tile, down[1]],
      [0, 0, tile, tile], [width - tile, 0, tile, tile], [0, height - tile, tile, tile], [width - tile, height - tile, tile, tile],
    ];
    state.tileNodes.forEach((node, index) => {
      set4(node, ...rects[index]);
      if (state.tiles !== set) node.setAttribute('href', set.urls[index]);
    });
    state.tiles = set;
  }

  function build(state) {
    const { el, kind } = state;
    if (destroyed || !state.visible) return;
    const rect = getComputedStyle(el);
    // Layout measurements deliberately exclude any press/entrance transform.
    const width = parseFloat(rect.width), height = parseFloat(rect.height);
    if (!width || !height || el.closest('[hidden]')) return;
    if (sample(state)) applyMaterial(state);
    const { radius, uniform } = cornerRadius(rect, width, height);
    // Supported silhouette: one circular radius on all four corners. Anything
    // else still renders, using the smallest corner, and is flagged so a host
    // can see that clip and optical field no longer describe the same shape.
    if (uniform) el.removeAttribute('data-surface-geometry');
    else el.dataset.surfaceGeometry = 'approximate';
    const preset = state.material;
    const density = Math.min(3, Math.max(2, devicePixelRatio || 1));
    // The reflection canvas keeps a pixel budget; displacement tiles do not need one.
    const scale = Math.min(density, Math.sqrt(1800000 / (width * height)));
    const key = [width, height, radius, scale, preset.shoulder, preset.displacement, preset.dispersion || 0].join(':');
    if (state.key === key) { paint(state); if (state.mirror) syncMirror(state); return; }
    state.key = key;
    const shoulder = Math.max(1, Math.min(preset.shoulder, radius * 0.85, height * 0.3));
    const displacement = Math.max(0, Math.min(preset.displacement, shoulder * 0.85));
    const corner = Math.max(0.5, Math.min(Math.max(radius, shoulder), width / 2, height / 2));
    const pixelWidth = Math.ceil(width * scale), pixelHeight = Math.ceil(height * scale);
    if (state.canvas.width !== pixelWidth) state.canvas.width = pixelWidth;
    if (state.canvas.height !== pixelHeight) state.canvas.height = pixelHeight;
    else state.context.clearRect(0, 0, pixelWidth, pixelHeight);
    Object.assign(state, { width, height, radius, scale, shoulder, displacement, corner });
    state.band = edgeBand(width, height, radius, scale, pixelWidth, pixelHeight);
    state.images = state.band.strips.map(strip => state.context.createImageData(strip.width, strip.height));
    paint(state);
    if (state.mirror) syncMirror(state);
    if (!supportsRefraction && !state.mirror) return;
    if (!state.filter) createFilter(state);
    const wanted = state.wanted = tileSet(radius / corner, shoulder / corner, Math.ceil(corner * density));
    el.dataset.surfaceRenderer = state.mirror ? 'mirror' : 'refractive';
    el.dataset.surfaceDisplacement = displacement.toFixed(1);
    el.dataset.surfaceDispersion = (preset.dispersion || 0).toFixed(2);
    const show = () => {
      el.style.setProperty('--surface-filter', `url("#${state.filter.id}")`);
      el.dataset.surfaceReady = '';
    };
    if (wanted.decoded) { layoutFilter(state, wanted); show(); return; }
    // Until the exact tiles are decoded, keep the tiles already on screen and
    // move them to the new geometry, so shape and refraction never separate.
    if (state.tiles) layoutFilter(state, state.tiles);
    const filter = state.filter;
    wanted.ready.then(() => {
      if (state.wanted !== wanted || state.filter !== filter || states.get(el) !== state) return;
      layoutFilter(state, wanted); show();
    }).catch(() => { if (!state.tiles) el.removeAttribute('data-surface-ready'); });
  }

  /** Resolve the element a host declared as this surface's backdrop, if any. */
  function backdropSource(el, options) {
    if (options.backdrop instanceof Element) return options.backdrop;
    const selector = typeof options.backdrop === 'string' ? options.backdrop : el.dataset.surfaceBackdrop;
    if (selector) {
      try { return el.parentElement?.closest(selector) || root.querySelector(selector); }
      catch { report('backdrop', selector); return null; }
    }
    const marked = el.parentElement?.closest('[data-surface-backdrop-root]');
    if (marked) return marked;
    // Manager-wide default, for an app with one backdrop behind everything.
    if (backdrop instanceof Element) return backdrop;
    if (typeof backdrop === 'string') {
      try { return root.querySelector(backdrop); } catch { report('backdrop', backdrop); }
    }
    return null;
  }
  function attachMirror(state) {
    const source = mirrorCapable ? backdropSource(state.el, state.options) : null;
    if (!source || source === state.el) return;
    const ancestor = source.contains(state.el);
    if (!ancestor && !elementImage) return;
    const wrap = document.createElement('span'), clip = document.createElement('span'), layer = document.createElement('span');
    wrap.className = 'surface-mirror'; clip.className = 'surface-mirror-clip'; layer.className = 'surface-mirror-layer';
    clip.append(layer); wrap.append(clip); state.optics.prepend(wrap);
    const mirror = state.mirror = { source, ancestor, wrap, clip, layer, assignedID: false, active: 0 };
    if (!ancestor && !source.id) { source.id = `liquid-backdrop-${++backdropIDs}`; mirror.assignedID = true; }
    mirrors.add(state);
    const signal = state.abort.signal, resync = () => queueMirrors();
    mirror.resize = new ResizeObserver(resync); mirror.resize.observe(source);
    // A copied background, and the source's own filter, have to follow class,
    // style and transition changes on the backdrop.
    mirror.mutations = new MutationObserver(resync);
    mirror.mutations.observe(source, { attributes: true, attributeFilter: ['class', 'style'] });
    const start = event => { if (event.target === source) { mirror.active++; queueMirrors(); } };
    const stop = event => { if (event.target === source) { mirror.active = Math.max(0, mirror.active - 1); queueMirrors(); } };
    for (const name of ['transitionrun', 'animationstart']) source.addEventListener(name, start, { signal });
    for (const name of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) source.addEventListener(name, stop, { signal });
  }
  function detachMirror(state) {
    const mirror = state.mirror;
    if (!mirror) return;
    mirror.resize.disconnect(); mirror.mutations?.disconnect();
    if (mirror.assignedID) mirror.source.removeAttribute('id');
    mirrors.delete(state); state.mirror = null;
  }
  const BACKGROUND = ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundColor', 'backgroundBlendMode'];
  /** Place the mirrored backdrop so it coincides with the real one behind the surface. */
  function syncMirror(state) {
    const { mirror, el } = state;
    if (!mirror || !state.width) return;
    const { source, layer } = mirror;
    const own = el.getBoundingClientRect(), behind = source.getBoundingClientRect();
    // Press and entrance transforms scale the surface; work in its layout pixels.
    const k = own.width / state.width || 1;
    const material = state.material;
    const pad = Math.ceil((material.displacement || 0) * 2 + (material.blur || 0) * 3 + 26);
    mirror.wrap.style.setProperty('--surface-mirror-pad', `${pad}px`);
    const inset = mirror.ancestor ? [source.clientLeft, source.clientTop] : [0, 0];
    layer.style.left = `${(behind.left - own.left) / k + inset[0] + pad}px`;
    layer.style.top = `${(behind.top - own.top) / k + inset[1] + pad}px`;
    layer.style.width = `${mirror.ancestor ? source.clientWidth : source.offsetWidth}px`;
    layer.style.height = `${mirror.ancestor ? source.clientHeight : source.offsetHeight}px`;
    if (mirror.ancestor) {
      const style = getComputedStyle(source);
      for (const name of BACKGROUND) if (layer.style[name] !== style[name]) layer.style[name] = style[name];
    } else {
      const image = `-moz-element(#${CSS.escape(source.id)}) no-repeat`;
      if (mirror.image !== image) layer.style.background = mirror.image = image;
      // An element image is the element before its own filter and opacity; a
      // dimmed or desaturated photo must look the same through the glass.
      const style = getComputedStyle(source), filter = style.filter === 'none' ? '' : style.filter;
      if (layer.style.filter !== filter) layer.style.filter = filter;
      if (layer.style.opacity !== style.opacity) layer.style.opacity = style.opacity;
    }
  }
  function queueMirrors() {
    if (mirrorFrame || destroyed) return;
    mirrorFrame = requestAnimationFrame(() => {
      mirrorFrame = 0;
      let running = false;
      mirrors.forEach(state => { if (state.visible) syncMirror(state); running ||= state.mirror.active > 0; });
      if (running) queueMirrors();
    });
  }
  // A backdrop that is not an ancestor moves independently of the surface.
  addEventListener('scroll', () => { if (mirrors.size) queueMirrors(); }, { capture: true, passive: true, signal });
  addEventListener('resize', () => { if (mirrors.size) queueMirrors(); }, { signal });

  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const state = states.get(target);
      if (!state) continue;
      if (target.isConnected) build(state);
      else releaseDetached(state);
    }
  });
  /** A host removed the element without unmounting it: drop the filter and
   * raster references now, and rebuild if the element is attached again. */
  function releaseDetached(state) {
    state.filter?.remove();
    state.filter = state.tiles = state.wanted = state.key = state.band = state.images = null;
    state.el.style.removeProperty('--surface-filter');
    state.el.removeAttribute('data-surface-ready');
    dirtyLights.delete(state);
  }
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = states.get(entry.target);
      if (state) { state.visible = entry.isIntersecting; if (state.visible) build(state); }
    });
  }, { rootMargin: '160px' });
  function unmount(el) {
    const state = states.get(el);
    if (!state) return;
    state.abort.abort(); observer.unobserve(el); visibility.unobserve(el);
    dirtyLights.delete(state); detachMirror(state);
    state.filter?.remove(); state.optics.remove();
    if (!state.hadClass) el.classList.remove('surface');
    state.styles.forEach(([value,priority],key) => value ? el.style.setProperty(key,value,priority) : el.style.removeProperty(key));
    state.attributes.forEach((value,key) => value === null ? el.removeAttribute(key) : el.setAttribute(key,value));
    states.delete(el);
    owners.delete(el);
  }
  function mount(el, options = {}) {
    if (destroyed) throw new Error('Cannot mount a destroyed surface manager.');
    if (states.has(el)) return states.get(el).handle;
    if (!(el instanceof Element)) throw new TypeError('createSurfaces().mount() requires an element.');
    // Another manager already renders this element. Mounting again would stack a
    // second set of optical layers, so the existing owner's handle is returned.
    const owner = owners.get(el);
    if (owner) return owner;
    const kind = options.kind || el.dataset.surface || 'control';
    const ownedStyles = ['--surface-filter', '--surface-tint', '--surface-blur', '--surface-x', '--surface-y', '--surface-reflection-opacity'];
    const ownedAttributes = ['data-surface','data-surface-geometry','data-surface-ready','data-surface-pressed','data-surface-renderer','data-surface-displacement','data-surface-dispersion','data-surface-appearance'];
    const styles = new Map(ownedStyles.map(key => [key,[el.style.getPropertyValue(key),el.style.getPropertyPriority(key)]]));
    const attributes = new Map(ownedAttributes.map(key => [key,el.getAttribute(key)]));
    const hadClass = el.classList.contains('surface');
    const optics = document.createElement('span');
    optics.className = 'surface-optics';
    optics.setAttribute('aria-hidden', 'true');
    optics.innerHTML = '<span class="surface-base"></span><span class="surface-warp"></span><span class="surface-tint"></span><canvas class="surface-reflection"></canvas><span class="surface-touch"></span>';
    el.prepend(optics);
    el.classList.add('surface');
    const canvas = optics.querySelector('canvas');
    const rect = el.getBoundingClientRect();
    const localAbort = new AbortController();
    const state = { el, optics, canvas, context: canvas.getContext('2d'), kind, options, lightX: 0,
      visible: rect.bottom > -160 && rect.top < innerHeight + 160,
      abort: localAbort, styles, attributes, hadClass };
    attachMirror(state);
    state.handle = {
      configure(next = {}) {
        if (states.get(el) !== state) return;
        state.options = { ...state.options, ...next, material: mergeMaterial(state.options.material, next.material) };
        state.kind = next.kind || state.kind;
        applyMaterial(state); build(state);
      },
      refresh() { if (states.get(el) === state) build(state); },
      /**
       * Describe the backdrop behind this surface: { luminance, density?, color? }.
       * null returns to the manager's sampler, or to the authored recipe.
       */
      setContext(context) {
        if (states.get(el) !== state) return;
        const next = context === null || context === undefined ? null : normalizeContext(context);
        if (context != null && !next) report('context', JSON.stringify(context));
        state.pushed = next ? next : undefined;
        state.backdrop = next;
        if (!next) sample(state);
        applyMaterial(state);
      },
      /** The context in effect and what the material did with it. */
      get context() {
        if (states.get(el) !== state) return null;
        return { ...(state.backdrop || { luminance: null, density: 0, color: null }),
          appearance: el.dataset.surfaceAppearance || null, protection: state.adapted?.protection ?? 0,
          tint: state.adapted?.tint ?? state.material.tint, blur: state.adapted?.blur ?? state.material.blur };
      },
      /** The validated recipe currently in effect (a copy). */
      get material() { return { ...state.material, lighting: { ...state.material.lighting } }; },
      /** Last built geometry in CSS pixels, or null before the first build. */
      get geometry() {
        if (states.get(el) !== state || !state.key) return null;
        const { width, height, radius, shoulder, displacement, scale } = state;
        return { width, height, radius, shoulder, displacement, scale };
      },
      destroy() { if (states.get(el) === state) unmount(el); },
    };
    states.set(el, state);
    owners.set(el, state.handle);
    applyMaterial(state);
    observer.observe(el);
    visibility.observe(el);
    build(state);
    // Only the nearest optical surface owns an interaction. Native foreground
    // buttons can share their parent's material; an explicit child lens cannot.
    const owns = event => event.target.closest('.surface') === el
      && !event.target.closest(':disabled, [aria-disabled="true"]');
    const positionLight = event => {
      if (motion.matches) { resetLight(state); return; }
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = clamp((event.clientX - r.left) / r.width);
      const y = clamp((event.clientY - r.top) / r.height);
      el.style.setProperty('--surface-x', `${x * 100}%`);
      el.style.setProperty('--surface-y', `${y * 100}%`);
      const lightX = (x - 0.5) * 2;
      if (state.lightX !== lightX) {
        state.lightX = lightX;
        queueLight(state);
      }
    };
    el.addEventListener('pointermove', event => {
      if (owns(event)) positionLight(event);
      // The pointer is over a nested lens (or a disabled control): this surface
      // returns to ambient light instead of keeping its last hover position.
      else if (state.pointer == null && state.lightX !== 0) resetLight(state);
    }, { signal: localAbort.signal });
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !owns(event)) return;
      positionLight(event);
      state.pointer = event.pointerId;
      el.dataset.surfacePressed = '';
    }, { signal: localAbort.signal });
    el.addEventListener('pointerleave', () => {
      clearPress(state); resetLight(state);
    }, { signal: localAbort.signal });
    el.addEventListener('keydown', event => {
      if (event.repeat || !owns(event) || !event.target.matches('button, a[href]')) return;
      if (event.key !== 'Enter' && !(event.key === ' ' && event.target.matches('button'))) return;
      resetLight(state);
      state.pressedKey = event.key;
      el.dataset.surfacePressed = '';
    }, { signal: localAbort.signal });
    el.addEventListener('focusout', () => clearPress(state), { signal: localAbort.signal });
    return state.handle;
  }
  const release = event => states.forEach(state => {
    if (state.pointer === event.pointerId) clearPress(state);
  });
  window.addEventListener('pointerup', release, { signal });
  window.addEventListener('pointercancel', release, { signal });
  window.addEventListener('keyup', event => states.forEach(state => {
    if (state.pressedKey === event.key) clearPress(state);
  }), { signal });
  const resetInteraction = () => states.forEach(state => { clearPress(state); resetLight(state); });
  window.addEventListener('blur', resetInteraction, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetInteraction();
  }, { signal });
  motion.addEventListener('change', resetInteraction, { signal });
  const scan = () => root.querySelectorAll('[data-surface]').forEach(el => { if (!owners.has(el) || states.has(el)) mount(el); });
  scan();
  return {
    mount,
    unmount,
    scan,
    refresh() { states.forEach(build); },
    renderer: supportsRefraction ? 'refractive' : 'css',
    /** True when surfaces with a declared backdrop are refracted by mirroring it. */
    mirror: mirrorCapable,
    destroy() {
      controller.abort(); cancelAnimationFrame(pending); cancelAnimationFrame(mirrorFrame);
      [...states.keys()].forEach(unmount);
      observer.disconnect(); visibility.disconnect(); definitions.remove(); destroyed = true;
    },
  };
}
