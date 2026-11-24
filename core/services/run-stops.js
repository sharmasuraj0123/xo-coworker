// @ts-check

/** @typedef {Readonly<{ key: string, what: string, session: string | null, until: number }>} PendingRunStop */

export function createPendingRunStops() {
  /** @type {Map<string, PendingRunStop>} */
  const stops = new Map();

  /** @param {PendingRunStop} job */
  function add(job) {
    if (stops.has(job.key)) return false;
    stops.set(job.key, job);
    return true;
  }

  /** @param {PendingRunStop} job */
  function remove(job) {
    return stops.get(job.key) === job && stops.delete(job.key);
  }

  /** @param {string} key */
  function undo(key) {
    const job = stops.get(key);
    if (job) remove(job);
    return job;
  }

  return { add, remove, undo, pending: () => [...stops.values()] };
}
