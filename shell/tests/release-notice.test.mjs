// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../../core/kernel/scope.js";
import { createConversationNotices } from "../../core/services/notices/line.js";
import { dom } from "../../tests/lib/dom.mjs";
import { mountReleaseNotice } from "../release-notice.js";

for (const trigger of ["release change", "failed chunk"]) {
  test(trigger + " offers one reload line at a time and offers it again after expiry", async t => {
    const { window } = await dom('<meta name="xo-ui-version" content="aaaaaaaaaaaa">');
    const origin = "https://example.test";
    let reloads = 0, entries, disconnected = false;
    const response = Promise.withResolvers();
    const probe = t.mock.method(globalThis, "fetch", () => response.promise);
    let now = 1000;
    t.mock.method(Date, "now", () => now);
    const notices = createConversationNotices(() => {});
    t.after(notices.dispose);
    const shown = t.mock.method(notices, "show");
    const scope = createScope();
    t.after(() => scope.dispose());
    globalThis.location = { origin, reload: () => reloads++ };
    globalThis.PerformanceObserver = class {
      static supportedEntryTypes = ["resource"];
      constructor(read) { entries = rows => read({ getEntries: () => rows }); }
      observe() {}
      disconnect() { disconnected = true; }
    };
    const ctx = { ...scope, use: () => notices };
    mountReleaseNotice(ctx);
    const resource = (path, status) => ({ name: origin + path, responseStatus: status });
    entries([resource("/api/projects", 503), resource("/v/aaaaaaaaaaaa/js/ok.js", 200)]);
    assert.equal(shown.mock.callCount(), 0);
    window.dispatchEvent(new window.Event("online"));
    window.dispatchEvent(new window.Event("pageshow"));
    assert.equal(probe.mock.callCount(), 1);
    const version = trigger === "release change" ? "bbbbbbbbbbbb" : "aaaaaaaaaaaa";
    response.resolve(new Response(null, { headers: { "X-XO-UI-Version": version } }));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(shown.mock.callCount(), trigger === "release change" ? 1 : 0);
    entries([resource("/v/aaaaaaaaaaaa/js/old.js", 404), resource("/v/aaaaaaaaaaaa/css/page.css", 404)]);
    mountReleaseNotice(ctx);
    assert.equal(shown.mock.callCount(), 1);
    assert.equal(notices.current().text, "XO was updated");
    assert.equal(notices.current().undoLabel, "Reload");
    now += 30001;
    assert.equal(notices.current(), null);
    if (trigger === "failed chunk") entries([resource("/v/aaaaaaaaaaaa/js/another.js", 404)]);
    else {
      window.dispatchEvent(new window.Event("online"));
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(shown.mock.callCount(), 2);
    assert.equal(reloads, 0);
    notices.undo();
    assert.equal(reloads, 1);
    scope.dispose();
    assert.equal(notices.has("system:ui-update"), false);
    assert.equal(disconnected, true);
  });
}

test("a queued reload waits behind an existing action without accumulating duplicate entries", t => {
  const notices = createConversationNotices(() => {});
  t.after(notices.dispose);
  notices.show({ mid: "prior", undo: () => {} }, 60000);
  notices.show({ mid: "system:ui-update", undo: () => {} }, 30000);
  assert.equal(notices.current().mid, "prior");
  assert.equal(notices.has("system:ui-update"), true);
  notices.drop("prior");
  assert.equal(notices.current().mid, "system:ui-update");
  notices.drop("system:ui-update");
  assert.equal(notices.has("system:ui-update"), false);
});
