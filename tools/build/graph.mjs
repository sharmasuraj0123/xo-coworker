import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse } from "acorn";
import { parseHTML } from "linkedom";
import { walk } from "../conformance/syntax.mjs";
import { stylesheetImport } from "../conformance/css-publication.mjs";
import { cssSyntax } from "../conformance/css-syntax.mjs";

export function publicGraph(root, built = false) {
  const found = new Set();
  const { document } = parseHTML(readFileSync(join(root, "index.html"), "utf8"));
  function visit(file) {
    const name = relative(root, file);
    if (found.has(name)) return;
    if (name.startsWith("..")) throw new Error(`Asset outside public root: ${name}`);
    if (statSync(file).isDirectory()) {
      for (const child of readdirSync(file, { recursive: true })) {
        if (/\.(?:m?js|css|woff2?|ttf)$/.test(child)) visit(join(file, child));
      }
      return;
    }
    found.add(name);
    function link(ref) {
      if (typeof ref !== "string" || !ref || /^(?:[a-z]+:|\/\/|#)/i.test(ref)) return;
      const path = ref.split(/[?#]/)[0];
      visit(path.startsWith("/") ? resolve(root, "." + path) : resolve(dirname(file), path));
    }
    if (name.endsWith(".css")) {
      const tree = cssSyntax(readFileSync(file, "utf8"), file, () => {});
      tree.walkAtRules("import", rule => link(stylesheetImport(rule.params).target));
      tree.walkDecls(decl => {
        for (const match of decl.value.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"]+))\s*\)/gi)) link(match[1] ?? match[2] ?? match[3]);
      });
    } else if (/\.m?js$/.test(name)) {
      walk(parse(readFileSync(file, "utf8"), { sourceType: "module", ecmaVersion: "latest" }), node => {
        if (node.source && /^(?:ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration|ImportExpression)$/.test(node.type)) {
          link(node.source.value);
        }
        if (!built && node.type === "NewExpression" && node.callee.name === "URL" && node.arguments[1]?.type === "MemberExpression"
            && node.arguments[1].object?.type === "MetaProperty") link(node.arguments[0]?.value);
      });
    }
  }
  for (const el of document.querySelectorAll("link[href],script[src]")) visit(resolve(root, el.getAttribute("href") ?? el.getAttribute("src")));
  for (const file of readdirSync(join(root, "core/services/shape/presets"))) visit(join(root, "core/services/shape/presets", file));
  visit(join(root, "apps-host/module.json"));
  return found;
}
