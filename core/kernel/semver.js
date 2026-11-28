// @ts-check

/** @param {string} v @returns {[number, number, number] | null} */
export function parse(v) {
  const m = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?\s*$/.exec(v);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}
/** @param {number[]} a @param {number[]} b */
const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);

/** @param {string} v @param {string} range */
export function satisfies(v, range) {
  const ver = parse(v);
  if (!ver || typeof range !== "string" || !range.trim()) return false;
  return range.split("||").some((part) => part.trim().split(/\s+/).every((c) => one(ver, c)));
}

/** @param {[number, number, number]} ver @param {string} c */
function one(ver, c) {
  if (c === "*" || c === "x") return true;
  const op = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(c);
  if (!op) return false;
  const [, sign = "", rest] = op;
  const parts = rest.replace(/^v/, "").split(".");
  const wild = parts.length < 3 || parts.some((p) => p === "x" || p === "*");
  const base = parse(parts.map((p) => (p === "x" || p === "*" ? "0" : p)).join("."));
  if (!base) return false;
  const known = parts.filter((p) => p !== "x" && p !== "*").length;
  if (sign === "^") {
    const upper = base[0] > 0 ? [base[0] + 1, 0, 0] : base[1] > 0 ? [0, base[1] + 1, 0] : [0, 0, base[2] + 1];
    return cmp(ver, base) >= 0 && cmp(ver, upper) < 0;
  }
  if (sign === "~") return cmp(ver, base) >= 0 && cmp(ver, [base[0], base[1] + 1, 0]) < 0;
  if (sign === ">=") return cmp(ver, base) >= 0;
  if (sign === ">") return cmp(ver, base) > 0;
  if (sign === "<=") return cmp(ver, base) <= 0;
  if (sign === "<") return cmp(ver, base) < 0;
  if (wild) return known === 0 || (ver[0] === base[0] && (known < 2 || ver[1] === base[1]));
  return cmp(ver, base) === 0;
}
