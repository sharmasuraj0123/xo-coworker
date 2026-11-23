// @ts-check

// A conversation's next write starts after its previous write settles.

export function sessionOrder() {
  /** @type {Map<string, Promise<void>>} */
  const last = new Map(); // conversation → its last write, settled either way

  /** @template T @param {string} s @param {() => T | Promise<T>} write */
  return (s, write) => {
    const p = (last.get(s) || Promise.resolve()).then(() => write());
    const settled = p.then(() => {}, () => {});
    last.set(s, settled);
    settled.then(() => { if (last.get(s) === settled) last.delete(s); });
    return p;
  };
}
