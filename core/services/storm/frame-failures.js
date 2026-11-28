// @ts-check
import { reportFailure } from "../notices/failures.js";

/** @param {import("./types").Ctx} ctx @param {string} key @param {string} message */
function reportOnce(ctx, key, message) {
  const counts = ctx.state.rejectedFrames;
  const count = counts.get(key) ?? 0;
  counts.set(key, count + 1);
  if (!count) reportFailure(new Error(message));
}

/** @param {import("./types").Ctx} ctx @param {string} type @param {string} field */
export function rejectFrame(ctx, type, field) {
  reportOnce(ctx, type + "." + field, `Couldn't apply a live ${type} update. Invalid ${field}.`);
}

/** Dropped from its read alone, and said. @param {import("./types").Ctx} ctx @param {string} what @param {string} field */
export function rejectItem(ctx, what, field) {
  reportOnce(ctx, "read." + what + "." + field, `Couldn't read one ${what}. Invalid ${field}.`);
}

/** @param {Record<string, unknown>} raw @param {Record<string, unknown>} defaults @param {(value: unknown) => boolean} guard */
export function invalidField(raw, defaults, guard) {
  for (const key of Object.keys(defaults)) if (!(key in raw)) return key;
  for (const [key, value] of Object.entries(raw)) if (!guard({ ...defaults, [key]: value })) return key;
  return "record";
}
