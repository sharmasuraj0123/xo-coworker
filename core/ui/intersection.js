// @ts-check

/** @param {ReturnType<typeof import("../kernel/scope.js").createScope>} scope @param {IntersectionObserverCallback} callback */
export function scopedIntersection(scope, callback) {
  if (typeof IntersectionObserver !== "function") return null;
  const observer = new IntersectionObserver(callback);
  scope.observe(observer);
  return observer;
}
