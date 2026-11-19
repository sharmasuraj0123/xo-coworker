// @ts-check

// A ```chart block's JSON spec drawn as HTML over one stretched SVG, as a string: no library, same spec same HTML, every word through esc().

import { esc } from "../../platform/index.js";

/** @typedef {[number, number | null]} Pt @typedef {{ name: string, pts: Pt[] }} Series */

/** @typedef {{ type: string, title: string, xLabel: string, yLabel: string, cats: string[] | null, series: Series[], yMin: number | null, yMax: number | null }} Chart */

const MAX_SERIES = 8, MAX_POINTS = 2000;
const num = (/** @type {unknown} */ v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const fin = (/** @type {unknown} */ v) => Number.isFinite(num(v));

/** The spec, read leniently and checked: {type, title, xLabel, yLabel, cats|null, series:[{name, pts:[[x,y]]}], yMin, yMax} or null. @param {unknown} src @returns {Chart | null} */
export function readChart(src) {
  /** @type {any} */
  let s;
  try { s = JSON.parse(String(src || "")); } catch { return null; }
  if (Array.isArray(s)) s = { series: [{ values: s }] };
  if (!s || typeof s !== "object") return null;
  const type = ["line", "area", "bar", "scatter"].includes(s.type) ? s.type : s.type === "column" ? "bar" : "line";
  const x = s.x && typeof s.x === "object" && !Array.isArray(s.x) ? s.x : { values: Array.isArray(s.x) ? s.x : s.labels };
  const y = s.y && typeof s.y === "object" ? s.y : {};
  const xs = Array.isArray(x.values) ? x.values.slice(0, MAX_POINTS) : null;
  const raw = (Array.isArray(s.series) ? s.series : []).slice(0, MAX_SERIES);
  /** @type {Series[]} */
  const series = [];
  for (const [i, r] of raw.entries()) {
    const name = String((r && r.name) ?? (raw.length > 1 ? `Series ${i + 1}` : "")).slice(0, 80);
    /** @type {Pt[]} */
    let pts = [];
    if (type === "scatter" && Array.isArray(r && r.points)) pts = r.points.slice(0, MAX_POINTS).filter((/** @type {any} */ p) => Array.isArray(p) && fin(p[0]) && fin(p[1])).map((/** @type {any[]} */ p) => /** @type {Pt} */ ([num(p[0]), num(p[1])]));
    else {
      const vals = Array.isArray(r) ? r : Array.isArray(r && r.values) ? r.values : Array.isArray(r && r.data) ? r.data : [];
      pts = vals.slice(0, MAX_POINTS).map((/** @type {unknown} */ v, /** @type {number} */ j) => /** @type {Pt} */ ([j, fin(v) ? num(v) : null]));
    }
    if (pts.some((p) => p[1] != null)) series.push({ name, pts });
  }
  if (!series.length) return null;
  const n = Math.max(...series.map((q) => q.pts.length));
  // the x axis: numbers place points by value (unevenly spaced samples stay true); anything else is categories
  const numericX = type !== "bar" && xs && xs.length >= n && xs.slice(0, n).every(fin);
  if (type !== "scatter") {
    if (numericX) for (const q of series) q.pts = q.pts.map(([j, v]) => /** @type {Pt} */ ([num(/** @type {unknown[]} */ (xs)[j]), v]));
  }
  const cats = type === "scatter" || numericX ? null : Array.from({ length: n }, (_, j) => String(xs && xs[j] != null ? xs[j] : j + 1).slice(0, 40));
  return {
    type, title: s.title ? String(s.title).slice(0, 200) : "", xLabel: x.label ? String(x.label).slice(0, 80) : "", yLabel: y.label ? String(y.label).slice(0, 80) : "",
    cats, series, yMin: fin(y.min) ? num(y.min) : null, yMax: fin(y.max) ? num(y.max) : null,
  };
}

/** Round tick values covering [lo, hi]: about `want` of them, on a 1-2-5 step. @param {number} lo @param {number} hi */
export function niceTicks(lo, hi, want = 5) {
  if (!(hi > lo)) { const d = Math.abs(lo) || 1; lo -= d / 2; hi += d / 2; }
  const raw = (hi - lo) / Math.max(1, want - 1), mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const out = [];
  for (let v = a, i = 0; v <= b + step / 2 && i < 50; v += step, i++) out.push(+v.toFixed(12));
  return { ticks: out, lo: a, hi: b, step };
}
/** A tick or value as people read it: whole thousands with separators, compact past 10,000, decimals as the step needs. @param {number | null | undefined} v */
export function fmt(v, step = 0) {
  if (v == null || !Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e4) {
    for (const [d, u] of /** @type {[number, string][]} */ ([[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]])) if (a >= d) return `${+(v / d).toFixed(a / d >= 100 ? 0 : 1)}${u}`;
  }
  // as many decimals as the step has (0.25 → 2), so ticks never round onto each other
  const dec = step ? Math.min(6, (String(+step.toPrecision(12)).split(".")[1] || "").length) : a && a < 1 ? 3 : 2;
  return v.toLocaleString("en-US", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

const pct = (/** @type {number} */ v) => `${+(v * 100).toFixed(3)}%`;

/** The chart's HTML for a chart block's source, or null when it isn't a chart XO can draw (shown as code then). @param {unknown} src */
export function chartHtml(src) {
  const c = readChart(src);
  if (!c) return null;
  const all = /** @type {[number, number][]} */ (c.series.flatMap((q) => q.pts.filter((p) => p[1] != null)));
  let lo = Math.min(...all.map((p) => p[1])), hi = Math.max(...all.map((p) => p[1]));
  // bars and areas grow from zero; a line keeps its own range (a fit near 1.0 shouldn't be squashed flat)
  if (c.type === "bar" || c.type === "area") { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (c.yMin != null) lo = Math.min(lo, c.yMin);
  if (c.yMax != null) hi = Math.max(hi, c.yMax);
  const Y = niceTicks(lo, hi, 5);
  const yv = (/** @type {number} */ v) => 1 - (v - Y.lo) / (Y.hi - Y.lo); // 0 at the top, 1 at the bottom
  /** x as a fraction of the plot's width @type {(x: number) => number} */
  let xv;
  /** @type {{ t: string, at: number }[]} */
  let xTicks;
  const n = c.cats ? c.cats.length : 0;
  if (c.cats) {
    const band = c.type === "bar";
    xv = (j) => (band ? (j + 0.5) / n : n === 1 ? 0.5 : j / (n - 1));
    const every = Math.max(1, Math.ceil(n / (band ? 12 : 8)));
    xTicks = c.cats.map((t, j) => ({ t, at: xv(j), show: j % every === 0 || (!band && j === n - 1 && (n - 1) % every >= every / 2) })).filter((x) => x.show);
  } else {
    const xsAll = all.map((p) => p[0]);
    const X = niceTicks(Math.min(...xsAll), Math.max(...xsAll), 6);
    xv = (x) => (x - X.lo) / (X.hi - X.lo);
    xTicks = X.ticks.map((t) => ({ t: fmt(t, X.step), at: xv(t) }));
  }
  const yTicks = Y.ticks.map((t) => ({ t: fmt(t, Y.step), at: yv(t) }));
  const yw = Math.max(...yTicks.map((t) => t.t.length));
  const col = (/** @type {number} */ i) => `var(--viz-${i + 1})`;
  // the SVG's own space: 1000 × 1000, stretched to the plot's box
  const P = (/** @type {number} */ x, /** @type {number} */ y) => `${+(x * 1000).toFixed(2)},${+(y * 1000).toFixed(2)}`;
  let svg = "";
  for (const t of yTicks) svg += `<line class="mc-grid${t.t === "0" ? " is-zero" : ""}" x1="0" x2="1000" y1="${+(t.at * 1000).toFixed(2)}" y2="${+(t.at * 1000).toFixed(2)}"/>`;
  let html = "";
  if (c.type === "line" || c.type === "area") {
    c.series.forEach((q, i) => {
      /** A gap in the data (null) breaks the line rather than inventing a value. @type {[number, number][][]} */
      const runs = [];
      /** @type {[number, number][]} */
      let run = [];
      for (const p of q.pts) { if (p[1] == null) { if (run.length) runs.push(run); run = []; } else run.push(/** @type {[number, number]} */ (p)); }
      if (run.length) runs.push(run);
      for (const r of runs) {
        const pts = r.map((p) => P(xv(p[0]), yv(p[1])));
        if (c.type === "area" && r.length > 1) svg += `<path class="mc-area" style="--c:${col(i)}" d="M${P(xv(r[0][0]), yv(Math.max(Y.lo, Math.min(0, Y.hi))))}L${pts.join("L")}L${P(xv(r[r.length - 1][0]), yv(Math.max(Y.lo, Math.min(0, Y.hi))))}Z"/>`;
        if (r.length > 1) svg += `<polyline class="mc-line" style="--c:${col(i)}" points="${pts.join(" ")}"/>`;
        else html += `<i class="mc-dot" style="--c:${col(i)};left:${pct(xv(r[0][0]))};top:${pct(yv(r[0][1]))}"></i>`;
      }
      // the end of each line carries a dot (with the surface ring), where the eye looks for "now"
      const last = /** @type {[number, number] | undefined} */ ([...q.pts].reverse().find((p) => p[1] != null));
      if (last && q.pts.filter((p) => p[1] != null).length > 1) html += `<i class="mc-dot" style="--c:${col(i)};left:${pct(xv(last[0]))};top:${pct(yv(last[1]))}"></i>`;
    });
  } else if (c.type === "bar") {
    const k = c.series.length, zero = yv(Math.max(Y.lo, Math.min(0, Y.hi)));
    c.series.forEach((q, i) => {
      for (const [j, v] of q.pts) {
        if (v == null) continue;
        const top = Math.min(yv(v), zero), h = Math.abs(yv(v) - zero);
        // each category's band: its bars side by side, 2 px apart, at most 24 px each (css/rich.css), centred
        html += `<i class="mc-bar${v < 0 ? " is-neg" : ""}" style="--c:${col(i)};--k:${k};--i:${i};left:${pct((j + 0.5) / n)};top:${pct(top)};height:${pct(h)}"></i>`;
      }
    });
  } else {
    c.series.forEach((q, i) => { for (const [x, y] of /** @type {[number, number][]} */ (q.pts)) html += `<i class="mc-dot is-pt" style="--c:${col(i)};left:${pct(xv(x))};top:${pct(yv(y))}"></i>`; });
  }
  const legend = c.series.length > 1 ? `<div class="mc-legend">${c.series.map((q, i) => `<span class="mc-key"><i class="mc-sw${c.type === "line" ? " is-line" : ""}" style="--c:${col(i)}"></i>${esc(q.name)}</span>`).join("")}</div>` : "";
  // the data as a table: for screen readers, and what the hover reads (one row per x)
  const head = `<tr><th scope="col">${esc(c.xLabel || "x")}</th>${c.series.map((q) => `<th scope="col">${esc(q.name || c.yLabel || "y")}</th>`).join("")}</tr>`;
  let rows = "";
  if (c.type === "scatter") {
    c.series.forEach((q) => { for (const [x, y] of q.pts) rows += `<tr><td>${esc(fmt(x))}</td>${c.series.map((s) => `<td>${s === q ? esc(fmt(y)) : ""}</td>`).join("")}</tr>`; });
  } else {
    const xsU = c.cats ? c.cats.map((_, /** @type {number} */ j) => j) : [...new Set(c.series.flatMap((q) => q.pts.map((p) => p[0])))].sort((a, b) => a - b);
    for (const xk of xsU) {
      const at = c.cats ? (c.type === "bar" ? (xk + 0.5) / n : xv(xk)) : xv(xk);
      rows += `<tr data-at="${+at.toFixed(5)}"><th scope="row">${esc(c.cats ? c.cats[xk] : fmt(xk))}</th>${c.series.map((q) => { const p = q.pts.find((pp) => pp[0] === xk); return `<td>${p && p[1] != null ? esc(fmt(p[1])) : "–"}</td>`; }).join("")}</tr>`;
    }
  }
  const label = [c.title || `${c.type} chart`, c.series.map((q) => q.name).filter(Boolean).join(", ")].filter(Boolean).join(": ");
  return `<figure class="md-chart" data-chart="${c.type}" role="group" aria-label="${esc(label)}" style="--yw:${yw}ch;--n:${Math.max(1, n)}">` +
    (c.title ? `<figcaption class="mc-title">${esc(c.title)}</figcaption>` : "") + legend +
    `<div class="mc-frame" aria-hidden="true">` +
      (c.yLabel ? `<span class="mc-yl">${esc(c.yLabel)}</span>` : "") +
      `<div class="mc-y">${yTicks.map((t) => `<span style="top:${pct(t.at)}">${esc(t.t)}</span>`).join("")}</div>` +
      `<div class="mc-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">${svg}</svg>${html}<div class="mc-hover"></div></div>` +
      `<div class="mc-x">${xTicks.map((t) => `<span style="left:${pct(t.at)}">${esc(t.t)}</span>`).join("")}</div>` +
      (c.xLabel ? `<span class="mc-xl">${esc(c.xLabel)}</span>` : "") +
    `</div>` +
    `<table class="sr-only mc-data"><thead>${head}</thead><tbody>${rows}</tbody></table></figure>`;
}
