// @ts-check

const MODULE_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/** @param {unknown} input @returns {string[]} */
export function manifestProblems(input) {
  const out = [];
  if (!input || typeof input !== "object") return ["the manifest is missing"];
  const m = /** @type {Record<string, unknown>} */ (input);
  if (typeof m.id !== "string" || !MODULE_ID.test(m.id)) out.push(`id must look like "xo.files" (got "${String(m.id)}")`);
  if (typeof m.version !== "string" || !/^\d+\.\d+\.\d+/.test(m.version)) {
    out.push(`version must be semver like "1.0.0" (got "${String(m.version)}")`);
  }
  if (typeof m.kernel !== "string" || !m.kernel) out.push(`kernel must name the kernel API range, e.g. "^1"`);
  for (const k of ["needs", "provides", "contributes", "defines", "routes", "storage", "styles", "vendor"]) {
    const value = m[k];
    if (value !== undefined && !(Array.isArray(value) && value.every((x) => typeof x === "string"))) {
      out.push(`${k} must be a list of strings`);
    }
  }
  return out;
}
