// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { stylesheetRows, valuesFor } from "./lib/css-snapshot.mjs";

test("the shell dock grip is a 24px band centred on the divider", () => {
  const band = ".shd-grip";
  assert.deepEqual(valuesFor(band, "position"), ["absolute"]);
  assert.deepEqual(valuesFor(band, "left"), ["0"]);
  assert.deepEqual(valuesFor(band, "right"), ["0"]);
  assert.deepEqual(valuesFor(band, "height"), ["24px"]);
  assert.deepEqual(valuesFor(band, "top"), ["calc(24px / -2)"]);
});

test("the grip pill is centred and its keyboard ring sits inside the band", () => {
  const pill = ".shd-grip::after";
  assert.deepEqual(valuesFor(pill, "width"), ["36px"]);
  assert.deepEqual(valuesFor(pill, "height"), ["4px"]);
  assert.deepEqual(valuesFor(pill, "top"), ["calc((24px - 4px) / 2)"]);
  assert.deepEqual(valuesFor(".shd-grip:focus-visible", "outline-offset"), ["-8px"]);
});

test("dock controls stack above the grip and the composer clears the upper half", () => {
  const [grip] = valuesFor(".shd-grip", "z-index");
  const [controls] = valuesFor(".shd-bar :is(button,[role=tab],a,input)", "z-index");
  assert.equal(Number(grip), 2);
  assert.ok(Number(controls) > Number(grip));
  const [composerPadding] = valuesFor(".cbar", "padding");
  assert.equal(typeof composerPadding, "string");
  const bottom = / (\d+)px$/.exec(String(composerPadding));
  assert.ok(bottom && Number(bottom[1]) >= 12);
});

test("the grip is hidden at the phone breakpoint", () => {
  const display = stylesheetRows.filter((row) =>
    row.context.at(-1)?.selector === ".shd-grip" && row.property === "display");
  assert.deepEqual(display.map((row) => [row.context[0].at, row.context[0].params, row.value]), [
    ["media", "(max-width:760px)", "none"],
  ]);
});
