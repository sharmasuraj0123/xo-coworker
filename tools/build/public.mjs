import { createHash } from "node:crypto";
import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const RESOURCES = ["vendor", "fonts", "favicon.svg", "core/ui/icons/source", "core/services/shape/presets", "apps-host/module.json"];

export function finishPublicTree(root, out) {
  for (const name of RESOURCES) {
    cpSync(join(root, name), join(out, name), {
      recursive: true,
      filter: file => !/\.(?:md|mts)$/i.test(file) || /^licenses?\b/i.test(basename(file)),
    });
  }
  const files = readdirSync(out, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name).slice(out.length + 1)).sort();
  const digest = createHash("sha256");
  for (const file of files) {
    const content = createHash("sha256").update(readFileSync(join(out, file))).digest("hex");
    digest.update(file + "\0" + content + "\n");
  }
  const version = digest.digest("hex").slice(0, 12);
  writeFileSync(join(out, ".build.json"), JSON.stringify({ version, files }) + "\n");
  return version;
}
