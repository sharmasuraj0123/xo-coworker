// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue, valuesFor } from "./lib/css-snapshot.mjs";

test("the chat notice stays fixed above an overlaying panel", () => {
  const selector = "body.stage-covers .herald:not(.tp .herald)";
  assert.deepEqual(valuesFor(selector, "position"), ["fixed"]);
});

test("only the covering stage gets the raised shadow in either theme", () => {
  assert.deepEqual(valuesFor(":where(.stage,.panel,.viewer)", "--shadow-stage"), ["none"]);
  assert.deepEqual(valuesFor("body.stage-over .stage", "--shadow-stage"), [resolveValue("var(--e2)")]);
  for (const selector of [".stage,.panel,body.stage-full .stage", ':root[data-theme="light"] :is(.stage,.panel,.viewer)']) {
    assert.deepEqual(valuesFor(selector, "box-shadow"), ["var(--shadow-stage,none)"]);
  }
});
