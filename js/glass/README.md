# js/glass — liquid glass for the composer

Vendored from the owner's liquid-glass library (cloned untracked at `docs/liquid-glass/` in the main
checkout; `lib/` at commit a3a3cac). Unchanged except one path in `surface-optics.js`' header.

- `surface.js` — `createSurfaces()`: the renderer (shared displacement tiles → SVG filter on `backdrop-filter`,
  a reflection canvas from the same shape field, pointer and contact light, lifecycle).
- `surface-optics.js` — the shoulder profile and shape field, adapted from Liqui Design (MIT, Fan Li;
  notice in `LICENSE-liqui-design.txt`).
- `surface-material.js`, `surface-context.js`, `optics.js` — recipe validation, backdrop context, helpers.
- `bar.js` — ours: mounts `#composer` as the `composer` surface.

The planes' CSS is `css/glass.css` (the library's `surface.css` on our motion tokens, plus the composer's
material per theme). Browser check: `tests/browser/glass-composer.test.cjs`.
