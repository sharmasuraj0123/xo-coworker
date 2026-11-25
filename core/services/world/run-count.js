// @ts-check

/** @typedef {{ runs?: { running?: number; waiting?: number } | null; session?: { live_runs?: number } | null }} ThreadCounts */

/** @param {ThreadCounts} thread @param {{ running: number; waiting: number } | undefined} counts */
export function workingRunCount(thread, counts) {
  return Math.max((thread.runs?.running || 0) + (thread.runs?.waiting || 0),
    counts ? counts.running + counts.waiting : 0, thread.session?.live_runs || 0);
}
