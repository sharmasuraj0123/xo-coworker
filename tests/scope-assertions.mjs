// @ts-check

import assert from "node:assert/strict";

/** @param {ReturnType<typeof import("../core/kernel/scope.js").createScope>} scope @param {() => void} [dispose] */
export function assertDisposed(scope, dispose = scope.dispose) {
  dispose();
  assert.equal(scope.signal.aborted, true);
  assert.equal(scope.size, 0);
}
