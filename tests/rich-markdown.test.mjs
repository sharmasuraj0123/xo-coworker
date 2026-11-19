// What a reply can hold beyond words (owner, 19 Nov): math, charts, diagrams and the conversation's own pictures, as
// js/markdown.js writes them (js/chart.js draws charts; js/rich.js draws math and diagrams in the browser, through
// setRich). Pure: node only.
//   node tests/rich-markdown.test.mjs
import assert from "node:assert/strict";
import { renderMarkdown, renderInline, setRich, imageLine } from "../js/markdown.js";
import { chartHtml, readChart, niceTicks, fmt } from "../js/chart.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const texOf = (html) => [...html.matchAll(/data-tex="([^"]*)"/g)].map((m) => m[1]);

// ── math ─────────────────────────────────────────────────────────────────
t("inline $…$ and \\(…\\) are formulas", () => {
  const out = renderInline("so $x^2 + y^2$ and \\(a+b\\) hold");
  assert.deepEqual(texOf(out), ["x^2 + y^2", "a+b"]);
  assert.match(out, /<span class="md-math" data-tex="x\^2 \+ y\^2">x\^2 \+ y\^2<\/span>/);
});
t("money and shell variables stay text", () => {
  for (const s of ["it costs $5 and $10", "$5-$10 a day", "use $HOME/$USER here", "from $3.50 to $4", "echo $PATH and $HOME"]) {
    assert.deepEqual(texOf(renderInline(s)), [], s);
  }
});
t("an escaped dollar is a dollar", () => {
  assert.equal(renderInline("\\$5 and \\$6"), "$5 and $6");
});
t("code keeps its dollars", () => {
  const out = renderInline("`$x$` and $y$");
  assert.match(out, /<code>\$x\$<\/code>/);
  assert.deepEqual(texOf(out), ["y"]);
});
t("display math: $$ on its own lines, on one line, \\[ \\], ```math", () => {
  for (const [src, tex] of [["$$\nE = mc^2\n$$", "E = mc^2"], ["$$ a+b $$", "a+b"], ["\\[\n\\int_0^1 x\\,dx\n\\]", "\\int_0^1 x\\,dx"], ["```math\nQ = \\frac{\\omega}{2\\gamma}\n```", "Q = \\frac{\\omega}{2\\gamma}"]]) {
    const out = renderMarkdown(src);
    assert.match(out, /^<div class="md-display"><span class="md-math is-block"/, src);
    assert.deepEqual(texOf(out), [tex.replace(/&/g, "&amp;")], src);
  }
});
t("an unclosed $$ (still streaming) is text, not a formula", () => {
  const out = renderMarkdown("$$\nE = mc^2");
  assert.doesNotMatch(out, /md-display/);
});
t("TeX is escaped, never markup", () => {
  const out = renderMarkdown('$<img src=x onerror=alert(1)>$ and $$"><script>$$');
  assert.doesNotMatch(out, /<img|<script/);
  assert.match(out, /&lt;img/);
});
t("a formula drawn before comes out drawn (setRich), so a redraw writes the same HTML", () => {
  setRich({ math: (tex, display) => (tex === "x" ? `<b class="k">${display ? "D" : "I"}</b>` : null) });
  try {
    assert.equal(renderInline("$x$ and $y$"), '<span class="md-math is-done" data-tex="x"><b class="k">I</b></span> and <span class="md-math" data-tex="y">y</span>');
    assert.match(renderMarkdown("$$\nx\n$$"), /is-block is-done" data-tex="x"><b class="k">D<\/b>/);
  } finally { setRich(null); }
});
t("a table cell can hold a formula", () => {
  assert.deepEqual(texOf(renderMarkdown("| p | v |\n|---|---|\n| $\\gamma$ | 0.07 |")), ["\\gamma"]);
});

// ── diagrams ─────────────────────────────────────────────────────────────
t("a closed ```mermaid is a diagram with its source; an open one is code", () => {
  const out = renderMarkdown("```mermaid\nflowchart LR\n  A --> B\n```");
  assert.equal(out, '<figure class="md-diagram"><pre class="md-dg-src"><code>flowchart LR\n  A --&gt; B</code></pre></figure>');
  assert.match(renderMarkdown("```mermaid\nflowchart LR"), /^<div class="md-code">/);
});
t("a diagram drawn before (any theme) comes out drawn; one that failed says why", () => {
  setRich({ diagram: (src) => (src.startsWith("ok") ? { html: "<svg></svg>", theme: "dark" } : { error: "bad <arrow>" }) });
  try {
    assert.match(renderMarkdown("```mermaid\nok\n```"), /^<figure class="md-diagram is-done" data-dg-theme="dark"><svg><\/svg><pre class="md-dg-src">/);
    const bad = renderMarkdown("```mermaid\nnope\n```");
    assert.match(bad, /md-diagram is-failed/);
    assert.match(bad, /couldn't be drawn: bad &lt;arrow&gt;/);
  } finally { setRich(null); }
});

// ── charts ───────────────────────────────────────────────────────────────
const SPEC = { type: "line", title: "Envelope", x: { label: "t (s)", values: [0, 5, 10] }, y: { label: "m" }, series: [{ name: "Measured", values: [1, 0.7, 0.49] }, { name: "Model", values: [1, 0.69, 0.5] }] };
t("a closed ```chart is a chart; a broken spec stays code", () => {
  const out = renderMarkdown("```chart\n" + JSON.stringify(SPEC) + "\n```");
  assert.match(out, /^<figure class="md-chart" data-chart="line" role="group" aria-label="Envelope: Measured, Model"/);
  assert.match(out, /<polyline class="mc-line" style="--c:var\(--viz-1\)"/);
  assert.match(out, /<polyline class="mc-line" style="--c:var\(--viz-2\)"/);
  assert.match(out, /class="mc-legend"/);
  assert.match(out, /<table class="sr-only mc-data">/);
  assert.match(renderMarkdown("```chart\n{not json\n```"), /^<div class="md-code">/);
  assert.match(renderMarkdown("```chart\n" + JSON.stringify(SPEC)), /^<div class="md-code">/, "unclosed: code while it streams");
});
t("one series has no legend; the title names it", () => {
  assert.doesNotMatch(chartHtml(JSON.stringify({ title: "x", series: [{ name: "a", values: [1, 2] }] })), /mc-legend/);
});
t("chart words are escaped", () => {
  const out = chartHtml(JSON.stringify({ title: "<script>", x: { values: ["<b>"] }, series: [{ name: "<i>", values: [1] }, { name: "y", values: [2] }] }));
  assert.doesNotMatch(out, /<script>|<b>|<i>/);
});
t("bars grow from zero, columns per category, negatives round below", () => {
  const out = chartHtml(JSON.stringify({ type: "bar", x: { values: ["a", "b"] }, series: [{ name: "s", values: [3, -1] }] }));
  assert.equal((out.match(/class="mc-bar/g) || []).length, 2);
  assert.match(out, /mc-bar is-neg/);
  assert.match(out, /mc-grid is-zero/);
});
t("shorthands: a bare array; labels; data", () => {
  assert.equal(readChart("[1,2,3]").series[0].pts.length, 3);
  const c = readChart(JSON.stringify({ labels: ["a", "b"], series: [{ name: "s", data: [1, 2] }] }));
  assert.deepEqual(c.cats, ["a", "b"]);
  assert.equal(readChart("{}"), null);
  assert.equal(readChart(JSON.stringify({ series: [{ values: ["x", null] }] })), null);
});
t("numeric x places points by value", () => {
  const c = readChart(JSON.stringify({ x: { values: [0, 1, 10] }, series: [{ values: [1, 2, 3] }] }));
  assert.equal(c.cats, null);
  assert.deepEqual(c.series[0].pts.map((p) => p[0]), [0, 1, 10]);
});
t("ticks are round; values read as people write them", () => {
  assert.deepEqual(niceTicks(0.06, 0.98, 5).ticks, [0, 0.25, 0.5, 0.75, 1]);
  assert.deepEqual(niceTicks(0, 1000, 5).ticks, [0, 250, 500, 750, 1000]);
  assert.equal(fmt(12500), "12.5K");
  assert.equal(fmt(1234), "1,234");
  assert.equal(fmt(0.25, 0.25), "0.25");
});

// ── pictures in the conversation's folder ────────────────────────────────
t("![alt](relative.png) is a picture in the conversation's folder", () => {
  assert.deepEqual(imageLine("![The fit](plots/fit.png)"), [{ alt: "The fit", file: "plots/fit.png" }]);
  assert.deepEqual(imageLine("![a](https://x.test/a.png)"), [{ alt: "a", url: "https://x.test/a.png" }]);
  assert.equal(imageLine("![a](../secret.png)"), null);
  assert.equal(imageLine("![a](notes.txt)"), null);
  // without the app's picture renderer it's the file's capsule (opens in Files)
  assert.match(renderMarkdown("![The fit](plots/fit.png)"), /data-file="plots\/fit.png"/);
});

console.log(`\n${passed} passed`);
