// @ts-check
import { reportFailure } from "../notices/failures.js";

/** @param {import("./types").Ctx} ctx @param {string} type @param {string} field */
export function rejectFrame(ctx, type, field) {
  const key = type + "." + field;
  const counts = ctx.state.rejectedFrames;
  const count = counts.get(key) ?? 0;
  counts.set(key, count + 1);
  if (!count) reportFailure(new Error(`Couldn't apply a live ${type} update. Invalid ${field}.`));
}

/** @param {Record<string, unknown>} raw @param {Record<string, unknown>} defaults @param {(value: unknown) => boolean} guard */
export function invalidField(raw, defaults, guard) {
  for (const key of Object.keys(defaults)) if (!(key in raw)) return key;
  for (const [key, value] of Object.entries(raw)) if (!guard({ ...defaults, [key]: value })) return key;
  return "record";
}
