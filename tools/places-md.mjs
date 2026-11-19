// node tools/places-md.mjs [--check]: writes the places catalogue from shell/places.js; --check fails when it is stale.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PLACES } from "../shell/places.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "architecture/places.md");
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
if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== md) { console.error("architecture/places.md is stale: run node tools/places-md.mjs"); process.exit(1); }
} else writeFileSync(OUT, md);
