// A stacked bar chart: each category's series sit on one another, and the axis reaches their sum.
import assert from "node:assert/strict";
import { chartHtml, readChart } from "../chart.js";

const series = [{ name: "A", values: [30, 10] }, { name: "B", values: [20, 0] }];
const spec = (extra) => JSON.stringify({ type: "bar", x: ["Mon", "Tue"], series, ...extra });
const axisTop = (html) => Math.max(...[...html.matchAll(/<span style="top:[\d.]+%">([\d.]+)<\/span>/g)].map((m) => Number(m[1])));
const bars = (html) => [...html.matchAll(/<i class="mc-bar([^"]*)" style="([^"]*)"/g)].map(([, cls, style]) => ({
  under: cls.includes("is-under"),
  k: /--k:(\d+)/.exec(style)?.[1],
  top: Number(/top:([\d.]+)%/.exec(style)?.[1]),
  height: Number(/height:([\d.]+)%/.exec(style)?.[1]),
}));

assert.equal(readChart(spec({})).stacked, false, "bars stay side by side unless asked");
assert.equal(readChart(spec({ stacked: true })).stacked, true);
const line = JSON.stringify({ type: "line", stacked: true, series: [{ values: [1] }, { values: [2] }] });
assert.equal(readChart(line).stacked, false, "only bars stack");

const html = chartHtml(spec({ stacked: true }));
const [a0, a1, b0] = bars(html);
assert.ok([a0, a1, b0].every((bar) => bar.k === "1"), "a stacked column is one bar wide");
assert.ok(a0.under && !a1.under && !b0.under, "only a segment with another on it loses its rounded top");
assert.ok(Math.abs(b0.top + b0.height - a0.top) < 0.01, "B's segment ends where A's begins");
assert.ok(Math.abs(a0.top + a0.height - 100) < 0.01, "the first series stands on the axis");
assert.ok(axisTop(html) >= 50 && b0.top >= 0, "the axis reaches the column's sum (50), not its biggest part (30)");
assert.ok(Math.abs(a0.height / b0.height - 30 / 20) < 0.01, "each segment is as tall as its own value");
assert.equal(bars(html).length, 3, "a zero adds no segment");

const sideBySide = bars(chartHtml(spec({})));
assert.ok(sideBySide.every((bar) => bar.k === "2" && !bar.under), "unstacked bars keep their own columns");
console.log("chart-stack: passed");
