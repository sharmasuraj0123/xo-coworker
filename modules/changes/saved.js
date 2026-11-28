// @ts-check

/** @import { ModuleContext } from "../../core/kernel/types" */

/** @param {Pick<import("./store.js").Changes, "saved">} changes @param {Pick<ModuleContext, "timeout" | "effect">} scope */
export function createSavedSoon(changes, scope) {
  /** @type {Map<string, () => void>} */
  const pending = new Map();
  scope.effect(() => () => pending.clear());
  /** @param {{ project: string; rel: string }} file */
  return function savedSoon({ project, rel }) {
    const key = `${project}|${rel}`;
    pending.get(key)?.();
    pending.set(key, scope.timeout(() => { pending.delete(key); changes.saved(project, rel); }, 2500));
  };
}
