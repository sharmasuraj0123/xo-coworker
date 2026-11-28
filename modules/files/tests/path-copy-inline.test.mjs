// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { deferred } from "../../../tests/lib/dom.mjs";
import { declarationsFor } from "../../../tests/lib/css-snapshot.mjs";
import { unavailable, viewerFixture } from "./viewer-fixture.mjs";

const { viewer, host, clipboard, click } = await viewerFixture();
const pending = deferred();
const copied = [];
clipboard.writeText = (text) => {
  copied.push(text);
  return pending.promise;
};
const pathCopy = () => host.querySelector(".vw-path button[data-vw-copy-path]");
mock.timers.enable({ apis: ["setTimeout"] });
try {
  viewer.open(unavailable());
  assert.ok(pathCopy().classList.contains("vw-path-copy"));
  assert.ok(!pathCopy().classList.contains("vw-btn"));
  assert.equal(pathCopy().type, "button");
  assert.equal(pathCopy().textContent.trim(), "Copy the path");
  click(".vw-path button");
  assert.equal(pathCopy().textContent.trim(), "Copy the path", "the pending label is delayed for a quick copy");
  mock.timers.tick(249);
  assert.equal(pathCopy().textContent.trim(), "Copying…");
  assert.equal(pathCopy().getAttribute("aria-busy"), "true");
  pending.resolve();
  await Promise.resolve();
  assert.equal(pathCopy().textContent.trim(), "Copied");
  assert.deepEqual(copied, [unavailable().path]);
  assert.equal(pathCopy().hasAttribute("aria-busy"), false);
  assert.ok(declarationsFor(".vw-path-copy svg", "width").some((row) => row.value === "var(--ic-sm)"));
  assert.ok(declarationsFor(".vw-path-copy svg", "height").some((row) => row.value === "var(--ic-sm)"));
  for (const selector of [".btn span", ".vw-path-copy span"]) {
    assert.ok(!declarationsFor(selector, "display").some((row) => row.value === "none"), selector);
  }
} finally {
  viewer.close();
  mock.timers.reset();
}
