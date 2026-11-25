import { createHash } from "node:crypto";
import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

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
    if (file.startsWith("js/") && file.endsWith(".js.map")) {
      const path = join(out, file);
      const map = JSON.parse(readFileSync(path, "utf8"));
      map.sources = map.sources.map(source => relative(root, resolve(dirname(path), source)));
      writeFileSync(path, JSON.stringify(map));
    }
    const content = createHash("sha256").update(readFileSync(join(out, file))).digest("hex");
    digest.update(file + "\0" + content + "\n");
  }
  const version = digest.digest("hex").slice(0, 12);
  const published = files.filter(file => !file.endsWith(".map"));
  writeFileSync(join(out, ".build.json"), JSON.stringify({ version, files: published }) + "\n");
  return version;
}
