// @ts-check

import { scopeOf } from "./scope.js";

/** @param {Parameters<typeof scopeOf>[0]} view @param {Parameters<typeof scopeOf>[1]} deps */
export function filePlace(view, deps) {
  const s = scopeOf(view, deps);
  return s.key === "all" ? null : { project: s.project, base: s.base || "", label: s.label + (s.sub ? ` · ${s.sub}` : "") };
}
