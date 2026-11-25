// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../../core/kernel/scope.js";
import { dom } from "../../tests/lib/dom.mjs";
import { mountReleaseNotice } from "../release-notice.js";

test("a missing lazy chunk and a changed release share one prompt with an explicit reload", async t => {
  const { window, document } = await dom('<meta name="xo-ui-version" content="aaaaaaaaaaaa"><div class="toast-wrap"></div>');
  const origin = "https://example.test";
  let reloads = 0, entries, disconnected = false;
  const response = Promise.withResolvers();
  const probe = t.mock.method(globalThis, "fetch", () => response.promise);
  const scope = createScope();
  t.after(() => scope.dispose());
  globalThis.location = { origin, reload: () => reloads++ };
  globalThis.PerformanceObserver = class {
    static supportedEntryTypes = ["resource"];
    constructor(read) { entries = rows => read({ getEntries: () => rows }); }
    observe() {}
    disconnect() { disconnected = true; }
  };
  mountReleaseNotice(scope);
  const resource = (path, status) => ({ name: origin + path, responseStatus: status });
  entries([resource("/api/projects", 503), resource("/v/aaaaaaaaaaaa/js/ok.js", 200)]);
  assert.equal(document.querySelector(".toast"), null);
  entries([resource("/v/aaaaaaaaaaaa/js/old.js", 404), resource("/v/aaaaaaaaaaaa/css/page.css", 404)]);
  assert.equal(document.querySelectorAll(".toast").length, 1);
  assert.match(document.querySelector(".toast").textContent, /couldn’t load/);
  window.dispatchEvent(new window.Event("online"));
  assert.equal(probe.mock.callCount(), 1);
  response.resolve(new Response(null, { headers: { "X-XO-UI-Version": "bbbbbbbbbbbb" } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.querySelectorAll(".toast").length, 1);
  assert.match(document.querySelector(".toast").textContent, /XO was updated/);
  assert.equal(reloads, 0);
  document.querySelector(".toast button").click();
  assert.equal(reloads, 1);
  scope.dispose();
  assert.equal(document.querySelector(".toast"), null);
  assert.equal(disconnected, true);
});
