// @ts-check

/** @import { createScope } from "../../core/kernel/scope.js" */

/** @param {ReturnType<typeof createScope>} scope @param {Blob} blob @param {string} name */
export function downloadViewerFile(scope, blob, name) {
  if (scope.signal.aborted) return;
  const url = URL.createObjectURL(blob);
  const revoke = scope.effect(() => () => URL.revokeObjectURL(url));
  scope.timeout(revoke, 60000);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", name);
  a.click();
}
