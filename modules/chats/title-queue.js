// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { isPending, once } from "../../core/platform/pending.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { scopedIntersection } from "../../core/ui/intersection.js";

const TITLE_READS = 4;

/** @param {Element | undefined} root @param {import("./read-types.d.ts").TitleSource} source */
export function createTitleQueue(root, { native, read, settled }) {
  const scope = createScope();
  /** @type {Map<Element, string>} */
  const observed = new Map();
  /** @type {Set<Element>} */
  const visible = new Set();
  /** @type {Map<string, { key: symbol, native: string | null }>} */
  const attempted = new Map();
  let running = 0;
  /** @type {string[]} */
  let candidates = [];
  let query = "";
  let queued = false;
  const idOf = (/** @type {Element} */ row) => row.getAttribute("data-go")?.slice(2) ?? "";
  const observer = root ? scopedIntersection(scope, (entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && observed.has(target)) visible.add(target);
      else visible.delete(target);
    }
    drain();
  }) : null;

  /** @param {string} id */
  function pending(id) {
    const current = native(id);
    const previous = attempted.get(id);
    return current && (!previous || previous.native !== current || isPending(previous.key));
  }

  function drain() {
    const ids = new Set([...visible].filter((row) => root?.contains(row)).map(idOf));
    if (query) for (const id of candidates) ids.add(id);
    for (const id of ids) {
      if (scope.signal.aborted || running >= TITLE_READS) return;
      const current = native(id);
      if (!current) continue;
      const attempt = attempted.get(id) ?? { key: Symbol(id), native: null };
      if (attempt.native === current || isPending(attempt.key)) continue;
      attempt.native = current;
      attempted.set(id, attempt);
      running++;
      void once(attempt.key, () => {
        if (!scope.signal.aborted) return read(id, current, scope.signal);
      }).catch((error) => {
        if (!scope.signal.aborted) reportFailure(error);
      }).then(() => {
        running--;
        if (scope.signal.aborted) return;
        settled();
        drain();
      });
    }
  }

  function syncRows() {
    if (!observer || !root) return;
    const rows = new Map();
    for (const row of root.querySelectorAll(".chl-row")) {
      const id = idOf(row);
      const key = native(id);
      if (key && attempted.get(id)?.native !== key) rows.set(row, key);
    }
    for (const [row, key] of observed) {
      if (rows.get(row) === key) continue;
      observer.unobserve(row);
      observed.delete(row);
      visible.delete(row);
    }
    for (const [row, key] of rows) {
      if (observed.has(row)) continue;
      observed.set(row, key);
      observer.observe(row);
    }
  }

  return {
    /** @param {string[]} ids @param {string} search */
    sync(ids, search) {
      candidates = ids;
      if (query !== search) {
        query = search;
        for (const [id, entry] of attempted) if (!isPending(entry.key)) attempted.delete(id);
      }
      if (!queued) {
        queued = true;
        queueMicrotask(() => {
          queued = false;
          if (scope.signal.aborted) return;
          syncRows();
          const current = new Set(candidates);
          for (const row of observed.keys()) current.add(idOf(row));
          for (const [id, entry] of attempted) if (!current.has(id) && !isPending(entry.key)) attempted.delete(id);
          drain();
        });
      }
      return !!query && candidates.some(pending);
    },
    /** @param {string} id */
    invalidate(id) {
      const attempt = attempted.get(id);
      if (attempt) attempt.native = null;
    },
    dispose: scope.dispose,
  };
}
