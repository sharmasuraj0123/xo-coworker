// @ts-check

/** @import { RunRow, SideDeps } from "./types" */

/** One run's report, read from the last thing its thread said. @param {SideDeps} deps @param {() => void} paint */
export function createReport(deps, paint) {
  /** @type {RunRow | null} */
  let run = null;
  /** @type {string | null} */
  let text = null;
  let failed = false;
  /** @type {AbortController | null} */
  let reading = null;

  /** @param {RunRow} r */
  async function read(r) {
    reading?.abort();
    const mine = reading = new AbortController();
    if (!r.thread || !deps.readReport) { text = ""; return; }
    try {
      text = await deps.readReport(r.thread.chat, r.thread.ts, mine.signal);
    } catch (error) {
      if (mine.signal.aborted) return;
      failed = true;
      deps.failed(error, "");
    }
    if (run === r) paint();
  }

  return {
    get run() { return run; },
    get text() { return text; },
    get failed() { return failed; },
    /** @param {RunRow} r */
    open(r) { run = r; text = null; failed = false; void read(r); paint(); },
    /** True when it was showing one. */
    close() { reading?.abort(); const was = !!run; run = null; return was; },
  };
}
