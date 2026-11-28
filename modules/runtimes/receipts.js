// @ts-check

/** @param {unknown} a @param {unknown} b */
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** @param {Pick<import("../../core/kernel/types").ModuleContext, "timeout">} scope @param {number} ms @param {() => void} onClear */
export function receipts(scope, ms, onClear) {
  /** @type {{ field: string, value: unknown } | null} */
  let cur = null;
  /** @type {(() => void) | undefined} */
  let cancel;
  return {
    get field() { return cur && cur.field; },
    /** @param {string} field @param {unknown} now */
    says(field, now) { return !!cur && cur.field === field && sameValue(cur.value, now); },
    /** @param {string} field @param {unknown} value */
    set(field, value) {
      cancel?.();
      cur = { field, value };
      cancel = scope.timeout(() => { cur = null; onClear(); }, ms);
    },
    clear() { cancel?.(); cur = null; },
  };
}
