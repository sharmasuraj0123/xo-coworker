// @ts-check

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { loadCM } from "../editor.js";

test("a failed CodeMirror load is retried and the successful load is shared", async () => {
  const entry = new URL("../../../vendor/codemirror/cm.js", import.meta.url).href;
  const refusal = new Error("CodeMirror temporarily unavailable");
  let attempts = 0;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === entry && ++attempts === 1) throw refusal;
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url !== entry) return next(url, context);
      return { format: "module", shortCircuit: true, source: "export class EditorView {}" };
    },
  });
  try {
    const first = loadCM();
    assert.equal(loadCM(), first);
    await assert.rejects(first, (error) => error === refusal);
    const retry = loadCM();
    assert.equal(loadCM(), retry);
    assert.equal(typeof (await retry).EditorView, "function");
    assert.equal(loadCM(), retry);
    assert.equal(attempts, 2);
  } finally {
    hooks.deregister();
  }
});
