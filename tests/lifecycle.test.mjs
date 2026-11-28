// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { checksLifecycle, lifecycleCounts } from "../tools/conformance/lifecycle.mjs";

test("lifecycle checks executable syntax and ignores lookalikes in source text", () => {
  assert.deepEqual(lifecycleCounts(`
    // new ResizeObserver(cb)
    const text = "setInterval(cb)";
    new window.ResizeObserver(cb);
    new MutationObserver(cb);
    setInterval(cb, delay);
    globalThis["setTimeout"](cb, delay);
    requestAnimationFrame(cb);
    window.document.addEventListener("click", cb);
    document["addEventListener"]("click", cb);
    scope.timeout(cb, delay);
    button.addEventListener("click", cb);
    localStorage.getItem("key");
    window["sessionStorage"].getItem("key");
    try { read(); } catch { /* ignored */ }
    try { read(); } catch { returnFallback(); }
  `), {
    observer: 2, setInterval: 1, setTimeout: 1, requestAnimationFrame: 1,
    globalListener: 2, storage: 2, commentOnlyCatch: 1,
  });
  assert.equal(checksLifecycle("modules/map/map.js"), true);
  assert.equal(checksLifecycle("modules/map/tests/map.test.mjs"), false);
  assert.equal(checksLifecycle("js/app.js"), true);
});
