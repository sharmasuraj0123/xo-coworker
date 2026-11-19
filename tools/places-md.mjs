// node tools/places-md.mjs [--check]: writes the places catalogue (markdown and JSON) from shell/places.js; --check fails when stale.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLACES } from "../shell/places.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "architecture/places.md");
const OUT_JSON = join(ROOT, "architecture/places.json");
const rows = PLACES.map((p) => `| \`${p.id}\` | ${p.kind} | ${p.scope} | ${p.openToApps ? "yes" : "no"} | ${p.requires.map((r) => `\`${r}\``).join(", ")} | ${p.description} |`);
const md = [
  "# Places",
  "",
  "Generated from `shell/places.js` by `node tools/places-md.mjs`; `node tools/check.mjs` fails when this file is stale.",
  "",
  "Every entry also has an `id`, and may have `order` (lists), `priority` (chains) and `when(at)`.",
  "",
  "| Place | Kind | Scope | Open to apps | Entry needs | What goes here |",
  "|---|---|---|---|---|---|",
  ...rows,
  "",
].join("\n");
const json = JSON.stringify({ kernel: "^1", places: PLACES.map(({ id, kind, scope, description, openToApps, requires }) => ({ id, kind, scope, description, openToApps: !!openToApps, requires })) }, null, 1) + "\n";
if (process.argv.includes("--check")) {
  const stale = [[OUT, md], [OUT_JSON, json]].filter(([f, t]) => !existsSync(f) || readFileSync(f, "utf8") !== t);
  if (stale.length) { console.error("the places catalogue is stale: run node tools/places-md.mjs"); process.exit(1); }
} else { writeFileSync(OUT, md); writeFileSync(OUT_JSON, json); }
