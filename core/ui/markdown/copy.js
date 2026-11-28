// @ts-check

import { createScope } from "../../kernel/scope.js";
import { copyText, COPY_REFUSED } from "../../platform/clipboard.js";

const ACKNOWLEDGEMENT_MS = 1400;

/** @param {(text: string, isCurrent: () => boolean) => void} announce */
export function createCodeCopy(announce) {
  const scope = createScope();
  /** @type {WeakMap<Element, {reset?: () => void}>} */
  const requests = new WeakMap();

  /** @param {Element} button */
  async function copy(button) {
    if (scope.signal.aborted) return;
    const current = { reset: requests.get(button)?.reset };
    requests.set(button, current);
    const isCurrent = () => !scope.signal.aborted && requests.get(button) === current;
    const text = button.closest(".md-code")?.querySelector("code")?.textContent ?? "";
    const copied = await copyText(text);
    if (!isCurrent()) return;
    current.reset?.();
    button.textContent = copied ? "Copied" : "Copy";
    announce(copied ? "Copied the code." : COPY_REFUSED, isCurrent);
    if (copied) current.reset = scope.timeout(() => { if (isCurrent()) button.textContent = "Copy"; }, ACKNOWLEDGEMENT_MS);
  }

  return { copy, dispose: scope.dispose };
}
