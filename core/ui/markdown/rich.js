// @ts-check

// Draws a reply's math (KaTeX) and diagrams (Mermaid) in place and gives charts their hover, only between keystrokes, every drawing cached by its source.

import { setRich } from "./inline.js";
import { createRichElements, RichInputError } from "./rich-elements.js";

const QUIET = 600; // ms without input before anything loads or draws
const SLICE = 8; // ms of drawing before yielding to the page
const MAX_TEX = 4000, MAX_DIAGRAM = 20000;
const root = document.documentElement;
const theme = () => `${root.dataset.theme === "light" ? "light" : "dark"}:${root.dataset.flavour || "stone"}`;

/** @type {Map<string, string>} */
const MATH = new Map(); // (display ? "D" : "I") + tex → KaTeX's HTML
/** @typedef {{ html: string, theme: string, w: number | null }} Drawing */

/** @type {Map<string, Drawing>} */
const DIAGRAMS = new Map(); // theme + "\n" + src → {html, theme}
/** @type {Map<string, Drawing>} */
const LATEST = new Map();
/** @type {Map<string, string>} */
const FAILED = new Map(); // src → why it couldn't be drawn (any theme)
const cap = (/** @type {Map<string, unknown>} */ m, n = 600) => { if (m.size > n) m.delete(/** @type {string} */ (m.keys().next().value)); };
/** A formula's drawing if it's been drawn (KaTeX's HTML), else null. Synchronous: markdown.js asks it as it writes. @param {string} tex */
function cachedMath(tex, display = false) { return MATH.get((display ? "D" : "I") + tex) ?? null; }
/** A diagram's drawing if drawn: {html, theme, w} for this theme (else the other's until redrawn), {error} if unreadable, else null. @param {string} src */
function cachedDiagram(src) {
  if (FAILED.has(src)) return { error: FAILED.get(src) };
  return DIAGRAMS.get(theme() + "\n" + src) || LATEST.get(src) || null;
}
setRich({ math: cachedMath, diagram: cachedDiagram });

let lastInput = -Infinity;
for (const t of ["keydown", "pointerdown", "wheel", "touchstart", "compositionupdate"]) addEventListener(t, () => { lastInput = performance.now(); }, { capture: true, passive: true });
const quietFor = () => performance.now() - lastInput;
function afterPause() {
  return new Promise((/** @type {(v?: unknown) => void} */ ok) => {
    const check = () => { const q = quietFor(); if (q >= QUIET) ok(); else setTimeout(check, QUIET - q + 16); };
    check();
  });
}

const PENDING = ".md-math:not(.is-done):not(.is-failed), .md-diagram:not(.is-done):not(.is-failed), .md-diagram.is-done:not([data-dg-theme])";
const { attached, isDrawing, ownRichElement, drawRichElement } = createRichElements(drawMath, diagramFor);
export { ownRichElement, drawRichElement };
let running = false, again = false;
function wake() {
  if (running) { again = true; return; }
  running = true;
  pass().catch((e) => console.warn("rich:", e)).finally(() => { running = false; if (again) { again = false; wake(); } });
}
async function pass() {
  for (;;) {
    const stale = document.querySelectorAll(`.md-diagram.is-done:not(.is-failed)[data-dg-theme]:not([data-dg-theme="${theme()}"])`);
    const candidates = /** @type {HTMLElement[]} */ ([...document.querySelectorAll(PENDING), ...stale]);
    const todo = candidates.filter((element) => attached(element) && !isDrawing(element));
    if (!todo.length) return;
    await afterPause();
    // what's on screen first, then the rest from the bottom up (the latest reply is what's being read)
    const vh = innerHeight;
    const rank = (/** @type {Element} */ el) => { const r = el.getBoundingClientRect(); return r.bottom >= 0 && r.top <= vh ? 0 : r.top > vh ? 1 : 2; };
    todo.sort((a, b) => rank(a) - rank(b));
    let t0 = performance.now(), did = 0;
    for (const el of todo) {
      if (!el.isConnected) continue;
      if (quietFor() < QUIET) break; // a key: stop, and wait for the next pause
      await drawRichElement(el);
      did++;
      if (performance.now() - t0 > SLICE) { await new Promise((r) => setTimeout(r, 0)); t0 = performance.now(); }
    }
    if (!did) await new Promise((r) => setTimeout(r, QUIET));
  }
}

/** @typedef {{renderToString(tex: string, options: Record<string, string | number | boolean>): string}} Katex */

/** @type {Promise<Katex> | null} */
let katexP = null;
function loadKatex() {
  const w = /** @type {Window & {katex?: Katex}} */ (window);
  if (w.katex) return Promise.resolve(w.katex);
  katexP ||= new Promise((ok, no) => {
    const base = new URL("../../../vendor/katex/", import.meta.url).href;
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: base + "katex.min.css" });
    const js = Object.assign(document.createElement("script"), { src: base + "katex.min.js", async: true });
    // the stylesheet first: a formula drawn before KaTeX's own CSS lands would show twice (HTML and MathML) for a frame
    let cssDone = false, jsDone = false;
    const both = () => { if (cssDone && jsDone) (w.katex ? ok(w.katex) : no(new Error("KaTeX didn't load"))); };
    css.onload = () => { cssDone = true; both(); };
    css.onerror = () => no(new Error("KaTeX's stylesheet didn't load"));
    js.onload = () => { jsDone = true; both(); };
    js.onerror = () => no(new Error("KaTeX didn't load"));
    document.head.append(css, js);
  });
  return katexP;
}
/** A cached formula, with malformed TeX rendered in place. @param {unknown} tex @returns {Promise<string>} */
async function drawMath(tex, display = false) {
  const t = String(tex ?? "");
  const key = (display ? "D" : "I") + t;
  const have = MATH.get(key);
  if (have != null) return have;
  if (t.length > MAX_TEX) throw new RichInputError("This formula is too long to draw here.");
  const katex = await loadKatex();
  // trust off (no \href, \includegraphics…), errors drawn in place in the error colour rather than thrown
  const html = katex.renderToString(t, { displayMode: display, throwOnError: false, trust: false, strict: "ignore", output: "htmlAndMathml", maxSize: 50, maxExpand: 500 });
  MATH.set(key, html); cap(MATH, 2000);
  return html;
}

/** @type {Promise<typeof import("../../../vendor/mermaid/mermaid.esm.min.mjs").default> | null} */
let mermaidP = null;
/** @type {string | null} */
let mermaidTheme = null;
let seq = 0;
/** A colour token as #rrggbb, whatever the stylesheet wrote it in (oklch, color-mix): Mermaid reads only plain colours. */
const probe = /** @type {CanvasRenderingContext2D} */ (document.createElement("canvas").getContext("2d", { willReadFrequently: true }));
/** @param {string} css @param {string} fallback */
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
/** @param {string} th */
async function mermaidFor(th) {
  mermaidP ||= import("../../../vendor/mermaid/mermaid.esm.min.mjs").then((m) => m.default);
  const mermaid = await mermaidP;
  if (mermaidTheme !== th) {
    // XO's own tokens, so a diagram reads as part of the page in either theme: stone nodes, hairline edges, ink text
    const v = (/** @type {string} */ t, /** @type {string} */ f) => hexOf(`var(${t})`, f);
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
/** Mermaid draws one diagram at a time through one queue (its configuration is global). @type {Promise<unknown>} */
let queue = Promise.resolve();
/** @type {Map<string, Promise<Drawing | { error: string }>>} */
const INFLIGHT = new Map();
/** Drawings and input errors are cached by the renderer. @param {string} src @returns {Promise<Drawing | { error: string }>} */
function diagramFor(src, th = theme()) {
  const key = th + "\n" + src;
  const have = DIAGRAMS.get(key);
  if (have) return Promise.resolve(have);
  if (FAILED.has(src)) return Promise.resolve({ error: /** @type {string} */ (FAILED.get(src)) });
  if (src.length > MAX_DIAGRAM) { FAILED.set(src, "it's too long to draw here."); return Promise.resolve({ error: /** @type {string} */ (FAILED.get(src)) }); }
  const going = INFLIGHT.get(key);
  if (going) return going;
  const p = queue.then(async () => {
    const id = `xo-dg-${++seq}`;
    try {
      const mermaid = await mermaidFor(th);
      let svg;
      try {
        ({ svg } = await mermaid.render(id, src));
      } catch (error) {
        if (!mermaidInputError(error)) throw error;
        const message = error.message.split("\n")[0].slice(0, 160);
        FAILED.set(src, message);
        return { error: message };
      }
      // drawn no wider than its viewBox and no narrower than 80 % of it: on a phone a wide diagram scrolls sideways
      const vb = /viewBox="[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)/.exec(svg);
      const got = { html: svg, theme: th, w: vb ? Math.round(+vb[1]) : null };
      DIAGRAMS.set(key, got); cap(DIAGRAMS, 200); LATEST.set(src, got); cap(LATEST, 200);
      return got;
    } finally {
      document.getElementById("d" + id)?.remove(); // Mermaid's scratch box, left behind when it throws
      INFLIGHT.delete(key);
    }
  });
  queue = p.then(() => {}, () => {});
  INFLIGHT.set(key, p);
  return p;
}
/** @param {unknown} error @returns {error is Error} */
function mermaidInputError(error) {
  return error instanceof Error && (error.name === "UnknownDiagramError" || error.name === "MermaidParseError"
    || ("hash" in error && /^(?:Parse|Lexical) error on line \d+/.test(error.message)));
}
/** Shows the values at the nearest x. @param {PointerEvent} e */
function chartHover(e) {
  const plot = /** @type {Element} */ (e.target).closest?.(".md-chart .mc-plot");
  if (!plot) return;
  const fig = /** @type {HTMLElement} */ (plot.closest(".md-chart"));
  const hov = /** @type {HTMLElement | null} */ (plot.querySelector(":scope > .mc-hover"));
  if (!hov || fig.dataset.chart === "scatter") return;
  const r = plot.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
  const rows = /** @type {HTMLElement[]} */ ([...fig.querySelectorAll(".mc-data tbody tr[data-at]")]);
  if (!rows.length) return;
  let best = rows[0], d = Infinity;
  for (const row of rows) { const dd = Math.abs(Number(row.dataset.at) - f); if (dd < d) { best = row; d = dd; } }
  const at = Number(best.dataset.at), names = [...fig.querySelectorAll(".mc-data thead th")].slice(1).map((th) => th.textContent);
  const vals = [...best.querySelectorAll("td")].map((td) => td.textContent);
  let tip = hov.querySelector(":scope > .mc-tip[data-own]");
  if (!tip) {
    hov.insertAdjacentHTML("beforeend", `<i class="mc-cross" data-own></i><div class="mc-tip" data-own></div>`);
    tip = hov.querySelector(":scope > .mc-tip");
  }
  if (!tip) return;
  tip.innerHTML = `<b></b>${vals.map((_, i) => `<span><i class="mc-sw" style="--c:var(--viz-${i + 1})"></i><em></em><strong></strong></span>`).join("")}`;
  const label = tip.querySelector("b");
  if (label) label.textContent = best.querySelector("th")?.textContent ?? "";
  tip.querySelectorAll("span").forEach((s, i) => {
    const name = s.querySelector("em"), value = s.querySelector("strong");
    if (name) name.textContent = names[i] || "";
    if (value) value.textContent = vals[i];
  });
  hov.style.setProperty("--at", `${at * 100}%`);
  hov.classList.toggle("is-left", at > 0.6);
  hov.classList.add("is-on");
}
/** @param {PointerEvent} e */
function chartLeave(e) {
  const plot = /** @type {Element} */ (e.target).closest?.(".md-chart .mc-plot");
  if (plot && !plot.contains(/** @type {Node | null} */ (e.relatedTarget))) {
    plot.querySelector(":scope > .mc-hover")?.classList.remove("is-on");
  }
}

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
