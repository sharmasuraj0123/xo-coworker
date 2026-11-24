// @ts-check

import { dirname, join } from "node:path/posix";
import { bindingNames, literal, SOURCE, TEST, walk } from "./syntax.mjs";

/** @param {object} node */
const name = (node) => node?.name ?? node?.value;

/** @param {string} file @param {object} tree */
export function moduleEdges(file, tree) {
  const exports = new Map();
  const stars = [];
  const imports = [];
  const target = (spec) => typeof spec === "string" && spec.startsWith(".") ? join(dirname(file), spec) : null;
  for (const node of tree.body) {
    const from = target(literal(node.source));
    if (node.type === "ImportDeclaration" && from) {
      for (const spec of node.specifiers) {
        const key = spec.type === "ImportDefaultSpecifier" ? "default" : name(spec.imported) ?? "*";
        imports.push([from, key]);
      }
    }
    if (node.type === "ExportAllDeclaration" && from) {
      if (node.exported) exports.set(name(node.exported), [node.loc.start.line, from, "*"]);
      else stars.push(from);
    }
    if (node.type === "ExportDefaultDeclaration") exports.set("default", [node.loc.start.line]);
    if (node.type !== "ExportNamedDeclaration") continue;
    const decl = node.declaration;
    const names = decl?.declarations
      ? decl.declarations.flatMap((item) => [...bindingNames(item.id)])
      : decl?.id ? [decl.id.name] : [];
    for (const key of names) exports.set(key, [node.loc.start.line]);
    for (const spec of node.specifiers) {
      exports.set(name(spec.exported), [spec.loc.start.line, from, name(spec.local)]);
    }
  }
  walk(tree, (node) => {
    if (node.type !== "ImportExpression") return;
    const from = target(literal(node.source));
    if (from) imports.push([from, "*"]);
  });
  return { exports, stars, imports };
}

/** @param {Map<string, ReturnType<typeof moduleEdges>>} graph @param {(file: string, rule: string, line: number, note: string) => void} report */
export function unusedExports(graph, report) {
  const used = new Map();
  function mark(file, key) {
    const item = graph.get(file);
    if (!item) return;
    const names = used.get(file) ?? new Set();
    if (names.has(key)) return;
    names.add(key);
    used.set(file, names);
    if (key === "*") {
      for (const exported of item.exports.keys()) mark(file, exported);
      for (const from of item.stars) mark(from, "*");
      return;
    }
    const decl = item.exports.get(key);
    if (decl) {
      if (decl[1]) mark(decl[1], decl[2]);
    } else if (key !== "default") {
      for (const from of item.stars) mark(from, key);
    }
  }
  for (const [file, item] of graph) {
    if (TEST.test(file)) continue;
    for (const [from, key] of item.imports) mark(from, key);
  }
  for (const [file, item] of graph) {
    if (!SOURCE.test(file) || TEST.test(file)) continue;
    for (const [key, [line]] of item.exports) {
      if (!used.get(file)?.has(key)) report(file, "unusedExport", line, key);
    }
  }
}
