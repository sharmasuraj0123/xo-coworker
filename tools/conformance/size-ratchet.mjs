// @ts-check

export const NEW_FILE_MAX = 400;

/** @param {Record<string, Record<string, number>>} actual @param {Record<string, Record<string, number>>} cap */
export function sizeRatchet(actual, cap) {
  const growth = [];
  const stale = [];
  for (const [kind, values] of Object.entries(actual)) {
    const unit = kind === "lines" ? "lines" : "!important";
    for (const [file, count] of Object.entries(values)) {
      const allowed = cap[kind][file] ?? 0;
      if (count <= allowed) continue;
      if (kind === "lines" && !allowed) growth.push(`  ${file}: ${count} lines; split at ${NEW_FILE_MAX} lines`);
      else growth.push(`  ${file}: ${count} ${unit}, allowed ${allowed}`);
    }
    for (const [file, allowed] of Object.entries(cap[kind])) {
      const count = values[file] ?? 0;
      if (count < allowed) stale.push(`  ${file}: stale ${unit} allowance ${allowed}; current count ${count}`);
    }
  }
  return { growth, stale };
}
