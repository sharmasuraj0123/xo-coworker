// @ts-check

import { dirname, join } from "node:path/posix";
import { isReference, lexicalBindings } from "./bindings.mjs";
import { bindingNames, literal, SOURCE, TEST, walk } from "./syntax.mjs";

/** @param {object} node */
const name = (node) => node?.name ?? node?.value;

/** @param {object} key @param {boolean} computed */
function propertyName(key, computed) {
  const value = computed ? literal(key) : name(key);
  return typeof value === "string" || typeof value === "number" ? String(value) : "*";
}

/** @param {object} pattern */
function patternUses(pattern) {
  if (pattern.type !== "ObjectPattern") return ["*"];
  return pattern.properties.map(item => item.type === "RestElement" ? "*" : propertyName(item.key, item.computed));
}

/** @param {object} node @param {object} parent */
function namespaceUses(node, parent) {
  if (parent?.type === "MemberExpression" && parent.object === node) {
    return [propertyName(parent.property, parent.computed)];
  }
  if (parent?.type === "VariableDeclarator" && parent.init === node) return patternUses(parent.id);
  if (parent?.type === "AssignmentExpression" && parent.right === node && parent.left.type === "ObjectPattern") {
    return patternUses(parent.left);
  }
  return ["*"];
}

/** @param {string} file @param {object} tree */
export function moduleEdges(file, tree) {
  const exports = new Map();
  const stars = [];
  const imports = [];
  const namespaces = new Map();
  const target = (spec) => typeof spec === "string" && spec.startsWith(".") ? join(dirname(file), spec) : null;
  for (const node of tree.body) {
    const from = target(literal(node.source));
    if (node.type === "ImportDeclaration" && from) {
      for (const spec of node.specifiers) {
        if (spec.type === "ImportNamespaceSpecifier") {
          namespaces.set(spec, from);
          continue;
        }
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
  const references = namespaces.size ? lexicalBindings(tree) : null;
  const parents = new WeakMap();
  walk(tree, (node, parent) => {
    parents.set(node, parent);
    if (node.type === "ImportExpression") {
      const from = target(literal(node.source));
      if (!from) return;
      const awaited = parent?.type === "AwaitExpression";
      const keys = awaited ? namespaceUses(parent, parents.get(parent)) : ["*"];
      for (const key of keys) imports.push([from, key]);
    } else if (references && isReference(node, parent)) {
      const from = namespaces.get(references.binding(node));
      if (!from) return;
      for (const key of namespaceUses(node, parent)) imports.push([from, key]);
    }
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
