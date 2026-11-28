// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../../../core/kernel/scope.js";
import { createPreviews } from "../previews.js";

for (const operation of ["open", "match", "put"]) {
  for (const expected of [true, false]) {
    test(`${operation} ${expected ? "expected" : "unexpected"} Cache Storage failure keeps the preview`, async (t) => {
      const attempts = [], reports = [], reads = [];
      const error = expected ? new DOMException("Cache Storage unavailable", "QuotaExceededError") : new Error("Cache failed");
      const fail = async () => { attempts.push(operation); throw error; };
      const cache = { match: operation === "match" ? fail : async () => undefined, put: operation === "put" ? fail : async () => {} };
      Object.assign(globalThis, {
        caches: { open: operation === "open" ? fail : async () => cache },
        reportError: (failure) => reports.push(failure),
      });
      t.after(() => { delete globalThis.caches; delete globalThis.reportError; });
      const scope = createScope();
      t.after(scope.dispose);
      const drawn = Promise.withResolvers();
      const previews = createPreviews({
        world: { thread: () => undefined },
        api: { projectFile: async (_, rel) => { reads.push(rel); return { content: "# Preview\n\nStill here." }; } },
        sharedFileRoute: () => ({}), box: () => null, landed: drawn.resolve, scope,
      });
      previews.loadTexts([{ key: "a", kind: "doc", name: "readme.md", fileProject: "a", rel: "readme.md" }]);
      await drawn.promise;
      assert.deepEqual(reads, ["readme.md"]);
      assert.deepEqual(previews.texts.get("a"), { kind: "doc", title: "Preview", text: "Still here." });
      assert.equal(previews.failed.has("a"), false);
      assert.equal(attempts.length, operation === "open" ? 2 : 1);
      assert.deepEqual(reports, expected ? [] : attempts.map(() => error));
    });
  }
}
