// @ts-check

/** @param {Element | null | undefined} from */
export function canRestoreFocus(from) {
  const active = document.activeElement;
  return !active || active === document.body || active === from || !active.isConnected;
}

/** @param {() => HTMLElement | null} root @param {(id: string) => HTMLElement | null} box */
export function createSettingsFocus(root, box) {
  /** @param {string} id @param {string | null | undefined} to */
  function target(id, to) {
    const control = to ? box(id)?.querySelector(to) : null;
    if (control instanceof HTMLElement && !("disabled" in control && control.disabled)) return control;
    const tab = root()?.querySelector(`[data-set="${CSS.escape(id)}"]`);
    return tab instanceof HTMLElement ? tab : null;
  }
  /** @param {string} id @param {string | null | undefined} to */
  function focusTo(id, to) {
    const control = target(id, to);
    if (!control) return;
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: "nearest" });
  }
  /** @param {string} id @param {string | null | undefined} to @param {Element | null | undefined} from */
  function land(id, to, from) {
    if (canRestoreFocus(from)) focusTo(id, to);
  }

  /** @param {Element | null} from @param {string} row @param {string} attr */
  function neighbour(from, row, attr) {
    const r = from?.closest(row);
    if (!r) return null;
    const directions = /** @type {const} */ (["nextElementSibling", "previousElementSibling"]);
    for (const dir of directions) {
      for (let x = r[dir]; x; x = x[dir]) {
        const b = x.querySelector(`[${attr}]:not(:disabled)`);
        if (b) return b.getAttribute(attr);
      }
    }
    return null;
  }

  return { focusTo, land, neighbour };
}
