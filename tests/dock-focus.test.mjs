import assert from "node:assert/strict";
import { rules, context, decls } from "./lib/cascade.mjs";
const ROOT = new URL("../", import.meta.url);
for (const w of [1440, 390]) {
  const set = rules(new URL("tests/lib/x.mjs", ROOT)).filter((r) => context(r, w).active && !context(r, w).cond && /(^|[\s>])\.tdock$/.test(r.sel))
    .flatMap((r) => decls(r.d).filter((d) => /^margin(-left)?$/.test(d.p)).map((d) => `${r.f}: ${r.sel} { ${d.p}: ${d.v} }`));
  assert.deepEqual(set, ["app.css: .tdock { margin-left: var(--col-x) }"], `at ${w}, the dock's left margin is set only as the column's`);
}
