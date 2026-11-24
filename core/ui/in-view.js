// @ts-check

/** @typedef {ReturnType<typeof import("../kernel/scope.js").createScope>} Scope */

/** @param {{ scope: Scope, concurrency: number, read: (node: Element, signal: AbortSignal) => Promise<void> }} options */
export function createInViewQueue({ scope, concurrency, read }) {
  /** @type {Set<Element>} */
  const observed = new Set();
  /** @type {Set<Element>} */
  const waiting = new Set();
  const active = new WeakSet();
  let running = 0;
  const { signal } = scope;

  function drain() {
    for (const node of waiting) {
      if (signal.aborted || running >= concurrency) return;
      waiting.delete(node);
      if (active.has(node) || !observed.has(node) || !node.isConnected) continue;
      active.add(node);
      running++;
      void Promise.resolve().then(() => {
        signal.throwIfAborted();
        return read(node, signal);
      }).then(() => {
        waiting.delete(node);
        observed.delete(node);
        observer.unobserve(node);
      }, (error) => {
        if (!signal.aborted) console.error(error);
      }).finally(() => {
        running--;
        active.delete(node);
        drain();
      });
    }
  }

  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && observed.has(target)) waiting.add(target);
      else waiting.delete(target);
    }
    drain();
  });
  scope.observe(observer);
  scope.effect(() => () => { waiting.clear(); observed.clear(); });

  /** @param {Iterable<Element>} nodes candidates that still need a read */
  return function sync(nodes) {
    if (signal.aborted) return;
    const current = new Set(nodes);
    for (const node of observed) {
      if (current.has(node)) continue;
      observer.unobserve(node);
      observed.delete(node);
      waiting.delete(node);
    }
    for (const node of current) {
      if (observed.has(node)) continue;
      observed.add(node);
      observer.observe(node);
    }
  };
}
