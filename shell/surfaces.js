// @ts-check

/** @import { Surface, SurfaceOptions } from "./surface-types.d.ts" */

/** @template C @param {SurfaceOptions} options */
export function createSurfaceSlots({ places, place, scope, schedule, fallback, hideOnRetire = false }) {
  /** @type {Map<Surface<C>, { host: HTMLElement, retire: () => void }>} */
  const mounted = new Map();
  /** @returns {Surface<C>[]} */
  const active = () => places.has(place) ? places.entries(place) : [];

  /** @param {Surface<C>} entry @param {HTMLElement} host */
  function mount(entry, host) {
    const retire = scope.effect(() => {
      const undo = entry.mount?.(host);
      return () => {
        mounted.delete(entry);
        const hadFocus = host.contains(host.ownerDocument.activeElement);
        try { undo?.(); } finally {
          host.replaceChildren();
          if (hideOnRetire) host.hidden = true;
          if (hadFocus) fallback()?.focus({ preventScroll: true });
        }
      };
    });
    if (!scope.signal.aborted) mounted.set(entry, { host, retire });
  }

  /** @param {Surface<C>[]} entries */
  function reconcile(entries) {
    const live = new Set(entries);
    for (const [entry, surface] of mounted) if (!live.has(entry)) surface.retire();
  }

  scope.effect(() => places.watch(place, () => {
    try { reconcile(active()); } finally { schedule(); }
  }));

  /** @param {(id: string) => HTMLElement | null} hostFor @param {C} context */
  function draw(hostFor, context) {
    if (scope.signal.aborted) return;
    const entries = active();
    reconcile(entries);
    for (const entry of entries) {
      const host = hostFor(entry.id);
      if (host !== mounted.get(entry)?.host) {
        mounted.get(entry)?.retire();
        if (host) mount(entry, host);
      }
      if (host && !scope.signal.aborted) entry.render(host, context);
    }
  }
  return draw;
}
