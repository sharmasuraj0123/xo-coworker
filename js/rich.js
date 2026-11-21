// What a reply can hold beyond words (owner, 19 Nov: "something that can write equations, code, show charts,
// diagrams, images"): this draws its math (KaTeX) and its diagrams (Mermaid), and gives charts (js/chart.js) their
// hover. markdown.js writes each formula and diagram as its source; this finds them and draws them in place.
//
// Never in the way of typing (the page is never idle: requestIdleCallback's deadline stays ~16 ms here, see
// js/diffview.js quiet()): nothing loads or draws until there's been no key, press, wheel or touch for QUIET ms,
// and the drawing goes in slices of a few ms that stop at the next keystroke and wait for the next pause. KaTeX
// (270 kB) and Mermaid (its core, then one chunk per diagram type) load only when a reply first has some, vendored
// under js/vendor/ (nothing from the network).
//
// Never a flicker or a jump on a redraw: every drawing is cached by its source (a diagram by its source and theme),
// and markdown.js asks the cache as it writes (setRich), so a message drawn again (each streamed chunk, js/redraw.js)
// comes out already drawn, the same HTML as what's on screen. A theme switch redraws diagrams in the background and
// swaps each when ready; until then a diagram keeps the drawing it has.

// For anything else that draws math or diagrams (Files' editor, whose widgets come and go as it scrolls), the same
// drawings are exported: drawMath(tex, display) and drawDiagram(src) → Promise<html>, and the synchronous cache reads
// cachedMath / cachedDiagram (what markdown.js asks through setRich). One cache and one Mermaid queue for the page.

import { setRich } from "./markdown.js";

const QUIET = 600; // ms without input before anything loads or draws
const SLICE = 8; // ms of drawing before yielding to the page
const MAX_TEX = 4000, MAX_DIAGRAM = 20000;
const root = document.documentElement;
const theme = () => `${root.dataset.theme === "light" ? "light" : "dark"}:${root.dataset.flavour || "stone"}`;

// ── caches the renderer reads synchronously ─────────────────────────────────
const MATH = new Map(); // (display ? "D" : "I") + tex → KaTeX's HTML
const DIAGRAMS = new Map(); // theme + "\n" + src → {html, theme}
const LATEST = new Map(); // src → its latest drawing in any look
const FAILED = new Map(); // src → why it couldn't be drawn (any theme)
const cap = (m, n = 600) => { if (m.size > n) m.delete(m.keys().next().value); };
/** A formula's drawing if it's been drawn (KaTeX's HTML), else null. Synchronous: markdown.js asks it as it writes. */
export function cachedMath(tex, display = false) { return MATH.get((display ? "D" : "I") + tex) ?? null; }
/** A diagram's drawing if it's been drawn: {html, theme, w} for this theme (else another look's, until this one is
 *  drawn), {error} if Mermaid couldn't read it, else null. Synchronous. */
export function cachedDiagram(src) {
  if (FAILED.has(src)) return { error: FAILED.get(src) };
  return DIAGRAMS.get(theme() + "\n" + src) || LATEST.get(src) || null;
}
setRich({ math: cachedMath, diagram: cachedDiagram });

// ── waiting for a pause in input ────────────────────────────────────────────
let lastInput = -Infinity;
for (const t of ["keydown", "pointerdown", "wheel", "touchstart", "compositionupdate"]) addEventListener(t, () => { lastInput = performance.now(); }, { capture: true, passive: true });
const quietFor = () => performance.now() - lastInput;
function afterPause() {
  return new Promise((ok) => {
    const check = () => { const q = quietFor(); if (q >= QUIET) ok(); else setTimeout(check, QUIET - q + 16); };
    check();
  });
}

// ── what waits to be drawn ──────────────────────────────────────────────────
const PENDING = ".md-math:not(.is-done):not(.is-failed), .md-diagram:not(.is-done):not(.is-failed), .md-diagram.is-done:not([data-dg-theme])";
let running = false, again = false;
function wake() {
  if (running) { again = true; return; }
  running = true;
  pass().catch((e) => console.warn("rich:", e)).finally(() => { running = false; if (again) { again = false; wake(); } });
}
async function pass() {
  for (;;) {
    const stale = [...document.querySelectorAll(`.md-diagram.is-done[data-dg-theme]:not([data-dg-theme="${theme()}"])`)];
    const todo = [...document.querySelectorAll(PENDING), ...stale];
    if (!todo.length) return;
    await afterPause();
    // what's on screen first, then the rest from the bottom up (the latest reply is what's being read)
    const vh = innerHeight;
    const rank = (el) => { const r = el.getBoundingClientRect(); return r.bottom >= 0 && r.top <= vh ? 0 : r.top > vh ? 1 : 2; };
    todo.sort((a, b) => rank(a) - rank(b));
    let t0 = performance.now(), did = 0;
    for (const el of todo) {
      if (!el.isConnected) continue;
      if (quietFor() < QUIET) break; // a key: stop, and wait for the next pause
      if (el.classList.contains("md-math")) await drawMathEl(el);
      else await drawDiagramEl(el);
      did++;
      if (performance.now() - t0 > SLICE) { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
    }
    if (!did) await new Promise((r) => setTimeout(r, QUIET));
  }
}

// ── math: KaTeX ─────────────────────────────────────────────────────────────
let katexP = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  katexP ||= new Promise((ok, no) => {
    const base = new URL("./vendor/katex/", import.meta.url).href;
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: base + "katex.min.css" });
    const js = Object.assign(document.createElement("script"), { src: base + "katex.min.js", async: true });
    // the stylesheet first: a formula drawn before KaTeX's own CSS lands would show twice (HTML and MathML) for a frame
    let cssDone = false, jsDone = false;
    const both = () => { if (cssDone && jsDone) (window.katex ? ok(window.katex) : no(new Error("KaTeX didn't load"))); };
    css.onload = () => { cssDone = true; both(); };
    css.onerror = () => no(new Error("KaTeX's stylesheet didn't load"));
    js.onload = () => { jsDone = true; both(); };
    js.onerror = () => no(new Error("KaTeX didn't load"));
    document.head.append(css, js);
  });
  return katexP;
}
/**
 * A formula drawn by KaTeX: its HTML (cached by its TeX, so the page and any editor share one drawing). Loads KaTeX
 * and its stylesheet the first time. Rejects when it can't be drawn (too long, KaTeX not loaded); a TeX error is
 * drawn in place in the error colour, not thrown. It doesn't wait for a pause in input: a caller drawing outside
 * the conversation (an editor's widget) decides when; the page's own pass waits (pass() below).
 */
export async function drawMath(tex, display = false) {
  tex = String(tex ?? "");
  const key = (display ? "D" : "I") + tex;
  let html = MATH.get(key);
  if (html != null) return html;
  if (tex.length > MAX_TEX) throw new Error("This formula is too long to draw here.");
  const katex = await loadKatex();
  // trust off (no \href, \includegraphics…), errors drawn in place in the error colour rather than thrown
  html = katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", output: "htmlAndMathml", maxSize: 50, maxExpand: 500 });
  MATH.set(key, html); cap(MATH, 2000);
  return html;
}
async function drawMathEl(el) {
  const tex = el.dataset.tex || "", display = el.classList.contains("is-block");
  let html;
  try { html = await drawMath(tex, display); } catch { el.classList.add("is-failed"); return; }
  if (!el.isConnected || el.dataset.tex !== tex) return;
  el.innerHTML = html;
  el.classList.add("is-done");
}

// ── diagrams: Mermaid ───────────────────────────────────────────────────────
let mermaidP = null, mermaidTheme = null, seq = 0;
/** A colour token as #rrggbb, whatever the stylesheet wrote it in (oklch, color-mix): Mermaid reads only plain colours. */
const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function hexOf(css, fallback) {
  const el = document.createElement("i");
  el.style.cssText = `position:absolute;visibility:hidden;color:${css}`;
  document.body.append(el);
  const c = getComputedStyle(el).color;
  el.remove();
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = fallback; probe.fillStyle = c; probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
async function mermaidFor(th) {
  mermaidP ||= import("./vendor/mermaid/mermaid.esm.min.mjs").then((m) => m.default);
  const mermaid = await mermaidP;
  if (mermaidTheme !== th) {
    // XO's own tokens, so a diagram reads as part of the page in either theme: stone nodes, hairline edges, ink text
    const v = (t, f) => hexOf(`var(${t})`, f);
    const ink = v("--ink", "#eee"), ink2 = v("--ink-2", "#ccc"), ink3 = v("--ink-3", "#999"), line = v("--line-strong", "#555");
    const node = v("--fill-2", "#2a2a2a"), canvas = v("--canvas", "#141414"), soft = v("--fill-1", "#1d1d1d");
    mermaid.initialize({
      startOnLoad: false, securityLevel: "strict", theme: "base", darkMode: th.startsWith("dark"),
      fontFamily: getComputedStyle(document.body).fontFamily, fontSize: 14,
      flowchart: { curve: "basis", padding: 12, nodeSpacing: 40, rankSpacing: 48, htmlLabels: true },
      themeVariables: {
        background: canvas, mainBkg: node, primaryColor: node, primaryTextColor: ink, primaryBorderColor: line,
        secondaryColor: soft, secondaryTextColor: ink, secondaryBorderColor: line, tertiaryColor: soft, tertiaryTextColor: ink, tertiaryBorderColor: line,
        lineColor: ink3, textColor: ink, titleColor: ink, nodeBorder: line, nodeTextColor: ink, clusterBkg: soft, clusterBorder: line,
        edgeLabelBackground: canvas, labelBackground: canvas, noteBkgColor: soft, noteTextColor: ink2, noteBorderColor: line,
        actorBkg: node, actorBorder: line, actorTextColor: ink, actorLineColor: ink3, signalColor: ink2, signalTextColor: ink, labelBoxBkgColor: node, labelBoxBorderColor: line, labelTextColor: ink, loopTextColor: ink2, activationBkgColor: soft, activationBorderColor: line, sequenceNumberColor: canvas,
        fontSize: "14px",
        // no drop shadows or gradients (Mermaid's themes add both): flat stone, as every card in XO
        dropShadow: "none", useGradient: false,
      },
    });
    mermaidTheme = th;
  }
  return mermaid;
}
// Mermaid draws one diagram at a time (its configuration is global, and a theme change re-initialises it), so every
// drawing, the page's and an editor's, goes through one queue; the same diagram asked twice shares one drawing.
let queue = Promise.resolve();
const INFLIGHT = new Map(); // theme + "\n" + src → its drawing's promise
/** {html, theme, w} for this theme, drawing it if needed; {error} when Mermaid can't read it. Never rejects. */
function diagramFor(src, th = theme()) {
  const key = th + "\n" + src;
  const have = DIAGRAMS.get(key);
  if (have) return Promise.resolve(have);
  if (FAILED.has(src)) return Promise.resolve({ error: FAILED.get(src) });
  if (src.length > MAX_DIAGRAM) { FAILED.set(src, "it's too long to draw here."); return Promise.resolve({ error: FAILED.get(src) }); }
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const p = (queue = queue.then(async () => {
    const id = `xo-dg-${++seq}`;
    try {
      const mermaid = await mermaidFor(th);
      const { svg } = await mermaid.render(id, src);
      // its natural width (the viewBox's): it's drawn no wider than that, and no narrower than 80 % of it, so on a
      // phone a wide diagram scrolls sideways in its card rather than shrinking to words no one can read
      const vb = /viewBox="[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)/.exec(svg);
      const got = { html: svg, theme: th, w: vb ? Math.round(+vb[1]) : null };
      DIAGRAMS.set(key, got); cap(DIAGRAMS, 200); LATEST.set(src, got); cap(LATEST, 200);
      return got;
    } catch (e) {
      FAILED.set(src, String((e && e.message) || "Mermaid couldn't read it.").split("\n")[0].slice(0, 160));
      return { error: FAILED.get(src) };
    } finally {
      document.getElementById("d" + id)?.remove(); // Mermaid's scratch box, left behind when it throws
      INFLIGHT.delete(key);
    }
  }));
  INFLIGHT.set(key, p);
  return p;
}
/**
 * A Mermaid diagram drawn in XO's tokens for the current theme: its SVG's HTML (cached by source and theme, shared
 * with the page). Loads Mermaid the first time. Rejects with Mermaid's reason when it can't read the source. Like
 * drawMath, it doesn't wait for a pause in input; drawings queue one at a time.
 */
export async function drawDiagram(src) {
  const got = await diagramFor(String(src ?? ""));
  if (got.error) throw new Error(got.error);
  return got.html;
}
async function drawDiagramEl(fig) {
  const src = fig.querySelector(":scope > .md-dg-src")?.textContent ?? "";
  const got0 = await diagramFor(src);
  const got = got0.error ? null : got0;
  if (!fig.isConnected || (fig.querySelector(":scope > .md-dg-src")?.textContent ?? "") !== src) return;
  if (got) {
    // swap the drawing in one step: the old one (another theme's) stays until this one is ready
    for (const old of fig.querySelectorAll(":scope > svg")) old.remove();
    fig.insertAdjacentHTML("afterbegin", got.html);
    fig.dataset.dgTheme = got.theme;
    if (got.w) fig.style.setProperty("--dg-w", got.w + "px"); else fig.style.removeProperty("--dg-w");
    fig.classList.add("is-done");
  } else if (FAILED.has(src)) {
    fig.classList.add("is-failed");
    if (!fig.querySelector(":scope > .md-dg-why")) fig.insertAdjacentHTML("afterbegin", `<figcaption class="md-dg-why"></figcaption>`);
    fig.querySelector(":scope > .md-dg-why").textContent = `This diagram couldn't be drawn: ${FAILED.get(src)}`;
  }
}

// ── charts: the value under the pointer ─────────────────────────────────────
// A crosshair at the nearest x and a small card with each series' value there, read from the chart's own data table.
function chartHover(e) {
  const plot = e.target.closest?.(".md-chart .mc-plot");
  if (!plot) return;
  const fig = plot.closest(".md-chart"), hov = plot.querySelector(":scope > .mc-hover");
  if (!hov || fig.dataset.chart === "scatter") return;
  const r = plot.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
  const rows = [...fig.querySelectorAll(".mc-data tbody tr[data-at]")];
  if (!rows.length) return;
  let best = rows[0], d = Infinity;
  for (const row of rows) { const dd = Math.abs(+row.dataset.at - f); if (dd < d) { d = dd; best = row; } }
  const at = +best.dataset.at, names = [...fig.querySelectorAll(".mc-data thead th")].slice(1).map((th) => th.textContent);
  const vals = [...best.querySelectorAll("td")].map((td) => td.textContent);
  let tip = hov.querySelector(":scope > .mc-tip[data-own]");
  if (!tip) {
    hov.insertAdjacentHTML("beforeend", `<i class="mc-cross" data-own></i><div class="mc-tip" data-own></div>`);
    tip = hov.querySelector(":scope > .mc-tip");
  }
  tip.innerHTML = `<b></b>${vals.map((_, i) => `<span><i class="mc-sw" style="--c:var(--viz-${i + 1})"></i><em></em><strong></strong></span>`).join("")}`;
  tip.querySelector("b").textContent = best.querySelector("th").textContent;
  tip.querySelectorAll("span").forEach((s, i) => { s.querySelector("em").textContent = names[i] || ""; s.querySelector("strong").textContent = vals[i]; });
  hov.style.setProperty("--at", `${at * 100}%`);
  hov.classList.toggle("is-left", at > 0.6);
  hov.classList.add("is-on");
}
function chartLeave(e) {
  const plot = e.target.closest?.(".md-chart .mc-plot");
  if (plot && !plot.contains(e.relatedTarget)) plot.querySelector(":scope > .mc-hover")?.classList.remove("is-on");
}

// ── wiring ──────────────────────────────────────────────────────────────────
let started = false;
/** Start watching the page for formulas and diagrams to draw (once). */
export function startRich() {
  if (started) return;
  started = true;
  // cheap per mutation: only a flag and one timer; the search runs once per batch
  let t = 0;
  new MutationObserver(() => { if (!t) t = setTimeout(() => { t = 0; if (document.querySelector(PENDING)) wake(); }, 50); })
    .observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => { if (document.querySelector(".md-diagram.is-done")) wake(); }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-flavour"] });
  document.addEventListener("pointermove", chartHover, { passive: true });
  document.addEventListener("pointerout", chartLeave, { passive: true });
  if (document.querySelector(PENDING)) wake();
}
