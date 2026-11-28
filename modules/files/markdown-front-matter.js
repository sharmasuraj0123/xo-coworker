// @ts-check

/** @typedef {{ to: number, fields: [string, string][] }} FrontMatter */

const OPEN = /^---[ \t]*\r?\n/;
const CLOSE = /\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const FIELD = /^([A-Za-z][\w -]{0,40}):[ \t]*(.*)$/;
const HEAD_LIMIT = 8192;

/** @param {string} value @returns {string} */
function scalar(value) {
  const v = value.trim();
  const list = /^\[(.*)\]$/.exec(v);
  if (list) return list[1].split(",").map(scalar).filter(Boolean).join(", ");
  return v.replace(/^(["'])(.*)\1$/, "$2");
}

/** The YAML block a document opens with, read as flat key: value pairs. @param {string} head @returns {FrontMatter | null} */
export function frontMatterOf(head) {
  const text = head.slice(0, HEAD_LIMIT);
  const open = OPEN.exec(text);
  if (!open) return null;
  const close = CLOSE.exec(text.slice(open[0].length - 1));
  if (!close) return null;
  const body = text.slice(open[0].length, open[0].length - 1 + close.index);
  if (!FIELD.test(body.trimStart().split(/\r?\n/, 1)[0])) return null;
  const to = open[0].length - 1 + close.index + close[0].replace(/\r?\n$/, "").length;
  /** @type {[string, string][]} */
  const fields = [];
  for (const line of body.split(/\r?\n/)) {
    const m = FIELD.exec(line);
    if (m && scalar(m[2])) fields.push([m[1].trim().toLowerCase(), scalar(m[2])]);
  }
  return { to, fields };
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A field's words as the page shows them: an ISO day spelled out, anything else as written. @param {string} value */
export function fieldText(value) {
  const day = DAY.exec(value);
  if (!day) return value;
  const date = new Date(Date.UTC(+day[1], +day[2] - 1, +day[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
