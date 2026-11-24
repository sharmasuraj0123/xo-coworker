// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { list } from "postcss";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { declarationsFor, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

const fills = declarationsFor((selector) => selector.includes(":active"));
const selectorOf = (row) => row.context.at(-1).selector;
const lifts = (selector) => ["--ink-3", "--ink-4"].every((property) =>
  declarationsFor(selector, property).some((row) => row.value === "var(--ink-2)"));

test("shared and dedicated press fills lift both secondary inks", () => {
  const shared = fills.find((row) => row.property === "background-image"
    && row.value === "linear-gradient(var(--press-fill),var(--press-fill))"
    && selectorOf(row).includes(":where(:active)"));
  assert.ok(shared);
  assert.ok(lifts(selectorOf(shared)));
  const own = fills.filter((row) => row.property === "background" && row.value === "var(--press-fill)");
  assert.ok(own.length >= 4);
  for (const row of own) {
    const selector = selectorOf(row);
    const host = selector.replace(/::before$/, "").replace(/:not\([^)]*\)$/, "");
    assert.ok(lifts(selector) || (selector.endsWith("::before") && lifts(host)), selector);
  }
});

const rgb = (value) => value.startsWith("#")
  ? [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
  : value.match(/[\d.]+/g).map(Number);
const lightChannel = (channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const luminance = (colour) => colour.slice(0, 3).map((channel) => lightChannel(channel / 255))
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
const ratio = (a, b) => {
  const [dark, light] = [luminance(a), luminance(b)].sort((p, q) => p - q);
  return (light + 0.05) / (dark + 0.05);
};

test("pressed, the second ink keeps 4.5:1 on every base", () => {
  const names = ["--press-fill", "--ink-2", "--surface", "--canvas", "--sunken", "--float"];
  const defaults = tokenValuesFor();
  const light = new Map([...defaults, ...tokenValuesFor(':root[data-theme="light"]')]);
  for (const theme of [defaults, light]) {
    const [fill, ink, ...backgrounds] = names.map((name) => rgb(substitute("var(" + name + ")", theme)));
    for (const background of backgrounds) {
      const pressed = background.map((channel, i) => channel * (1 - fill[3]) + fill[i] * fill[3]);
      assert.ok(ratio(ink, pressed) >= 4.5, "foreground " + ink + " over " + pressed);
    }
  }
});

test("the Changes mark styles stay scoped to their row", () => {
  const bare = declarationsFor((selector) => list.comma(selector).some((part) => /^\.ch-m(?:\.[\w-]+)?$/.test(part)));
  assert.deepEqual(bare, []);
  assert.deepEqual(valuesFor(".ch-r .ch-m", "flex"), ["none"]);
  assert.equal(declarationsFor(".ch-r .ch-m", "color")[0].value, "var(--ink-4)");
  assert.equal(declarationsFor(".ch-r .ch-m", "font")[0].value,
    "var(--fw-medium) var(--fs-meta)/var(--lh-meta) var(--sans)");
  assert.deepEqual(valuesFor(".chl-m"), []);
});
