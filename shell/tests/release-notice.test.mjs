// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../../core/kernel/scope.js";
import { dom } from "../../tests/lib/dom.mjs";
import { mountReleaseNotice } from "../release-notice.js";

for (const trigger of ["release change", "failed chunk"]) {
  test(trigger + " offers the existing notice action once per tab", async t => {
    const { window } = await dom('<meta name="xo-ui-version" content="aaaaaaaaaaaa">');
    const origin = "https://example.test";
    let reloads = 0, entries, disconnected = false;
    const response = Promise.withResolvers();
    const probe = t.mock.method(globalThis, "fetch", () => response.promise);
    const scope = createScope(), lines = [], dropped = [];
    t.after(() => scope.dispose());
    globalThis.location = { origin, reload: () => reloads++ };
    globalThis.PerformanceObserver = class {
      static supportedEntryTypes = ["resource"];
      constructor(read) { entries = rows => read({ getEntries: () => rows }); }
      observe() {}
      disconnect() { disconnected = true; }
    };
    const ctx = { ...scope, use: () => ({ show: notice => lines.push(notice), drop: id => dropped.push(id) }) };
    mountReleaseNotice(ctx);
    const resource = (path, status) => ({ name: origin + path, responseStatus: status });
    entries([resource("/api/projects", 503), resource("/v/aaaaaaaaaaaa/js/ok.js", 200)]);
    assert.equal(lines.length, 0);
    window.dispatchEvent(new window.Event("online"));
    window.dispatchEvent(new window.Event("pageshow"));
    assert.equal(probe.mock.callCount(), 1);
    const version = trigger === "release change" ? "bbbbbbbbbbbb" : "aaaaaaaaaaaa";
    response.resolve(new Response(null, { headers: { "X-XO-UI-Version": version } }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lines.length, trigger === "release change" ? 1 : 0);
    entries([resource("/v/aaaaaaaaaaaa/js/old.js", 404), resource("/v/aaaaaaaaaaaa/css/page.css", 404)]);
    mountReleaseNotice(ctx);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, "XO was updated");
    assert.equal(lines[0].undoLabel, "Reload");
    assert.equal(reloads, 0);
    lines[0].undo();
    assert.equal(reloads, 1);
    scope.dispose();
    assert.deepEqual(dropped, ["system:ui-update"]);
    assert.equal(disconnected, true);
  });
}
