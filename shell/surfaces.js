// @ts-check

/** @import { Surface, SurfaceOptions, SurfaceScope } from "./surface-types.d.ts" */

/** @param {SurfaceScope} scope @param {HTMLElement} host @param {() => void} undo @param {SurfaceOptions<unknown>["fallback"]} fallback */
export function ownSurface(scope, host, undo, fallback, hideOnRetire = false) {
  return scope.effect(() => () => {
    const hadFocus = host.contains(host.ownerDocument.activeElement);
    try { undo(); } finally {
      host.replaceChildren();
      if (hideOnRetire) host.hidden = true;
      if (hadFocus) fallback()?.focus({ preventScroll: true });
    }
  });
}

/** @template C @param {SurfaceOptions<C>} options */
export function createSurfaceSlots({ read, places, place, scope, schedule, fallback, hideOnRetire = false }) {
  /** @type {Map<Surface<C>, { host: HTMLElement, retire: () => void }>} */
  const mounted = new Map();
  /** @returns {Surface<C>[]} */
  const active = () => places.has(place) ? read() : [];

  /** @param {Surface<C>} entry @param {HTMLElement} host */
  function mount(entry, host) {
    if (scope.signal.aborted) return;
    const undo = entry.mount?.(host);
    const retire = ownSurface(scope, host, () => { mounted.delete(entry); undo?.(); }, fallback, hideOnRetire);
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

  /** @param {(id: string) => HTMLElement | null} hostFor @param {C} context @param {string} [selected] */
  function draw(hostFor, context, selected) {
    if (scope.signal.aborted) return;
    const entries = active();
    reconcile(entries);
    for (const entry of entries) {
      if (selected !== undefined && entry.id !== selected) continue;
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
