// @ts-check

const FRESH_MS = 1500;
const REFRESH_MS = 1560;

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "timeout">} scope @param {() => void} schedule */
export function createChecklistState(scope, schedule) {
  /** @type {Set<string>} */
  const open = new Set();
  /** @type {Map<string, number>} */
  const seen = new Map();
  /** @type {WeakMap<HTMLElement, string>} */
  const markup = new WeakMap();
  /** @type {{ id: string, text: string, until: number } | undefined} */
  let fresh;
  /** @type {(() => void) | undefined} */
  let refresh;

  return {
    isOpen: open.has.bind(open),
    /** @param {string} id */
    toggle(id) { if (!open.delete(id)) open.add(id); },
    /** @param {string} id @param {number} done @param {string} [text] */
    progress(id, done, text) {
      const previous = seen.get(id);
      if (previous !== undefined && done > previous) {
        fresh = { id, text: text ?? "Step done", until: Date.now() + FRESH_MS };
        refresh?.();
        refresh = scope.timeout(schedule, REFRESH_MS);
      }
      seen.set(id, done);
      return fresh?.id === id && fresh.until > Date.now() ? fresh : undefined;
    },
    forgetMarkup: markup.delete.bind(markup),
    /** @param {HTMLElement} host @param {string} html */
    changed(host, html) {
      if (markup.get(host) === html) return false;
      markup.set(host, html);
      return true;
    },
  };
}
