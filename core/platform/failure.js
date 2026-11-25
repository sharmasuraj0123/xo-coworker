// @ts-check

const RETAINED_DETAILS = 8;
const QUIET_MS = 30000;
const MAX_STACK = 2048;

/** @typedef {{ text: string, details: string }} FailureNotice */

/** @param {unknown} error */
function messageOf(error) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "";
}

/** @param {unknown} error @param {string} message */
function ignored(error, message) {
  return (error && typeof error === "object" && "name" in error && error.name === "AbortError")
    || /^(?:Uncaught )?ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)\.?$/.test(message);
}

/** @param {string} source */
function description(source) {
  if (!/^xo\.[a-z0-9-]+$/.test(source)) return "Something went wrong in the app.";
  const words = source.slice(3).replaceAll("-", " ");
  const name = words === "github" ? "GitHub" : words[0].toUpperCase() + words.slice(1);
  return `${name} couldn’t start.`;
}

/** @param {unknown} error */
function stackOf(error) {
  if (!error || typeof error !== "object" || !("stack" in error) || typeof error.stack !== "string") return "";
  return error.stack.slice(0, MAX_STACK);
}

/** @param {(notice: FailureNotice) => void} show @param {(flush: () => void) => void} [schedule] @param {() => number} [now] */
export function createFailureSurface(show, schedule = queueMicrotask, now = Date.now) {
  /** @type {Map<string, { summary: string, detail: string, stack: string, count: number }>} */
  const items = new Map();
  let total = 0, omitted = 0, previous = 0, scheduled = false;
  function flush() {
    scheduled = false;
    const entries = [...items.values()];
    const text = entries.length === 1 && !omitted ? entries[0].summary : "Something went wrong in the app.";
    const details = entries.map(({ detail, stack, count }) => detail + (count > 1 ? ` (×${count})` : "") + (stack ? "\n" + stack : ""));
    if (omitted) details.push(`${omitted} additional reports`);
    show({ text: total > 1 ? `${text} (${total} reports)` : text, details: details.join("\n") });
  }
  return {
    /** @param {unknown} error @param {string | import("../kernel/types").FaultSource} source */
    report(error, source) {
      const message = messageOf(error);
      if (ignored(error, message)) return;
      const time = now();
      if (time - previous >= QUIET_MS) { items.clear(); total = 0; omitted = 0; }
      previous = time;
      total++;
      const msg = message.slice(0, 512) || "No further details were provided.";
      const id = (typeof source === "string" ? source : source.module).slice(0, 128);
      const phase = typeof source === "string" ? "" : source.phase.slice(0, 64);
      const key = JSON.stringify([id, phase, msg]);
      const item = items.get(key);
      if (item) item.count++;
      else if (items.size < RETAINED_DETAILS) {
        const subject = typeof source === "string" ? "" : source.subject?.slice(0, 128);
        const label = [id, phase, subject].filter(Boolean).join(" / ");
        const summary = description(!phase || phase === "activation" ? id : "");
        items.set(key, { summary, detail: `${label}: ${msg}`, stack: stackOf(error), count: 1 });
      }
      else omitted++;
      if (!scheduled) { scheduled = true; schedule(flush); }
    },
  };
}
