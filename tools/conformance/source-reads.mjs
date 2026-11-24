// @ts-check

import { dirname, join, normalize, relative } from "node:path/posix";
import { literal, member, SOURCE, TEST, walk } from "./syntax.mjs";

const FS = /^(?:node:)?fs(?:\/promises)?$/;
const READ = /^(?:readFile|readFileSync|createReadStream)$/;
const SOURCE_EXTENSION = /\.(?:[cm]?js|css|html|py|ts)$/i;
const FIXTURE = /(?:^|\/)(?:fixtures?|snapshots?|testdata)(?:\/|$)/;

/** @param {object} tree */
function bindings(tree) {
  const readers = new Set();
  const namespaces = new Set();
  const values = new Map();
  walk(tree, (node, parent) => {
    if (node.type === "ImportDeclaration" && FS.test(node.source.value)) {
      for (const specifier of node.specifiers) {
        if (READ.test(specifier.imported?.name ?? "")) readers.add(specifier.local.name);
        if (specifier.type !== "ImportSpecifier") namespaces.add(specifier.local.name);
      }
    }
    if (node.type !== "VariableDeclarator" || parent.kind !== "const") return;
    if (node.id.type === "Identifier") values.set(node.id.name, node.init);
    if (node.init?.callee?.name !== "require" || !FS.test(literal(node.init.arguments[0]))) return;
    if (node.id.type === "Identifier") namespaces.add(node.id.name);
    for (const property of node.id.properties ?? []) {
      if (READ.test(property.key?.name ?? "")) readers.add(property.value.name);
    }
  });
  return { readers, namespaces, values };
}

/** @param {object} node @param {string} file @param {Map<string, object>} values @param {Set<object>} [seen] */
function pathValue(node, file, values, seen = new Set()) {
  if (!node || seen.has(node)) return undefined;
  const visited = new Set(seen).add(node);
  const atom = literal(node);
  if (typeof atom === "string") return atom;
  if (node.type === "TemplateLiteral") return node.quasis.map((part) => part.value.cooked).join("*");
  if (node.type === "Identifier") return pathValue(values.get(node.name), file, values, visited);
  const read = (part) => pathValue(part, file, values, visited);
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return (read(node.left) ?? "*") + (read(node.right) ?? "*");
  }
  if (node.type === "NewExpression" && node.callee.name === "URL") {
    const [target, base] = node.arguments;
    const basePath = member(base) === "url" && base.object.type === "MetaProperty" ? file : read(base);
    if (basePath && !/^[a-z]+:/i.test(basePath)) {
      const baseDir = basePath.endsWith("/") ? basePath : dirname(basePath);
      const path = read(target) ?? "*";
      if (/^[a-z]+:|^\//i.test(path)) return path;
      return join(baseDir, path) + (path.endsWith("/") ? "/" : "");
    }
  }
  if (node.type === "CallExpression" && ["join", "resolve"].includes(node.callee.name ?? member(node.callee))) {
    return join(...node.arguments.map((arg) => read(arg) ?? "*"));
  }
}

/** @param {string} file @param {object} tree @param {Set<string>} files @param {Function} report */
export function sourceReads(file, tree, files, report) {
  const { readers, namespaces, values } = bindings(tree);
  walk(tree, (node) => {
    if (node.type !== "CallExpression") return;
    const { callee } = node;
    const isRead = readers.has(callee.name)
      || (READ.test(member(callee) ?? "") && namespaces.has(callee.object?.name));
    if (!isRead) return;
    const path = pathValue(node.arguments[0], file, values);
    if (path && (FIXTURE.test(path) || (/\.[\w]+$/.test(path) && !SOURCE_EXTENSION.test(path)))) return;
    const line = node.loc.start.line;
    report("sourceRead", line);
    if (!path) return;
    const candidates = new Set([normalize(path), normalize(join(dirname(file), path))]);
    for (const part of candidates) {
      if (!part.includes("*")) {
        if (files.has(part) && SOURCE.test(part) && !TEST.test(part)) report("sourceReadTarget", line, part);
        continue;
      }
      const segments = part.split("*");
      if (!segments[0] || !SOURCE.test(segments[0])) continue;
      const pattern = new RegExp("^" + segments.map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
      for (const candidate of files) {
        if (TEST.test(candidate) || !pattern.test(candidate)) continue;
        const location = relative(dirname(file), candidate);
        if (!FIXTURE.test(location)) report("sourceReadTarget", line, candidate);
      }
    }
  });
}
