// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { sizeRatchet } from "../size-ratchet.mjs";

const exact = { lines: { "css/app.css": 657, "css/panel.css": 536 }, important: { "css/panel.css": 10 } };

test("exact size ratchets accept current counts", () => {
  assert.deepEqual(sizeRatchet(exact, exact), { growth: [], stale: [] });
});

test("a stale source line allowance is rejected independently", () => {
  const cap = { ...exact, lines: { ...exact.lines, "css/app.css": 1377 } };
  const result = sizeRatchet(exact, cap);
  assert.deepEqual(result.growth, []);
  assert.deepEqual(result.stale, ["  css/app.css: stale lines allowance 1377; current count 657"]);
});

test("a stale important allowance is rejected independently", () => {
  const cap = { ...exact, important: { ...exact.important, "css/panel.css": 11 } };
  const result = sizeRatchet(exact, cap);
  assert.deepEqual(result.growth, []);
  assert.deepEqual(result.stale, ["  css/panel.css: stale !important allowance 11; current count 10"]);
});

test("a raise in either measured count is forbidden", () => {
  const actual = { lines: { ...exact.lines, "css/app.css": 658 }, important: { "css/panel.css": 11 } };
  const result = sizeRatchet(actual, exact);
  assert.deepEqual(result.stale, []);
  assert.deepEqual(result.growth, ["  css/app.css: 658 lines, allowed 657", "  css/panel.css: 11 !important, allowed 10"]);
});
