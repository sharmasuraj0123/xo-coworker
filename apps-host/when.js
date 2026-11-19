// @ts-check

/** @typedef {{ key: string, op: "==" | "!=", value: string }} Test @typedef {Test[][]} When */

export const WHEN_KEYS = Object.freeze(["view", "canvas.app", "artifact.type", "thread.state", "app.enabled"]);
const TEST = /^\s*([a-z]+(?:\.[a-z]+)?)\s*(==|!=)\s*'([^'\\]{0,100})'\s*$/;

/** A when clause ("view == 'thread' && canvas.app == 'space.xo.word'"), parsed; || binds looser than &&. @param {unknown} text @returns {When | string} */
export function parseWhen(text) {
  if (typeof text !== "string" || !text.trim() || text.length > 400) return "a when clause must be short text";
  /** @type {When} */
  const out = [];
  for (const alt of text.split("||")) {
    /** @type {Test[]} */
    const all = [];
    for (const part of alt.split("&&")) {
      const m = TEST.exec(part);
      if (!m) return `"${part.trim()}" must look like key == 'value'`;
      if (!WHEN_KEYS.includes(m[1])) return `"${m[1]}" isn't one of ${WHEN_KEYS.join(", ")}`;
      all.push({ key: m[1], op: /** @type {"==" | "!="} */ (m[2]), value: m[3] });
    }
    out.push(all);
  }
  return out;
}

/** @param {When | undefined} when @param {Record<string, unknown>} at */
export function holds(when, at) {
  if (!when) return true;
  return when.some((all) => all.every((t) => (String(at[t.key] ?? "") === t.value) === (t.op === "==")));
}
