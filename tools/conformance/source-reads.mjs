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
  const names = new Map();
  walk(tree, (node, parent) => {
    if (node.type === "Identifier") names.set(node.name, (names.get(node.name) ?? 0) + 1);
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
  return { readers, namespaces, values, names };
}

/** @param {object} node @param {string} file @param {Map<string, object>} values @param {Set<object>} [seen] */
function pathValue(node, file, values, seen = new Set()) {
  if (!node || seen.has(node)) return undefined;
  const visited = new Set(seen).add(node);
  const atom = literal(node);
  if (typeof atom === "string") return atom;
  if (node.type === "TemplateLiteral") {
    return node.quasis.map((part, index) => {
      const value = part.tail ? "" : pathValue(node.expressions[index], file, values, visited) ?? "*";
      return part.value.cooked + value;
    }).join("");
  }
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

/** @param {object} tree @param {Map<string, object>} values @param {Map<string, number>} names */
function literalMaps(tree, values, names) {
  const inputs = new WeakMap();
  walk(tree, (node) => {
    if (node.type !== "CallExpression" || member(node.callee) !== "map") return;
    const receiver = node.callee.object;
    const array = receiver.type === "Identifier" && names.get(receiver.name) === 2 ? values.get(receiver.name) : receiver;
    if (array?.type !== "ArrayExpression" || array.elements.some((item) => typeof literal(item) !== "string")) return;
    const [fn] = node.arguments;
    if (!["ArrowFunctionExpression", "FunctionExpression"].includes(fn?.type)) return;
    const [parameter] = fn.params;
    const body = fn.body.type === "BlockStatement" && fn.body.body.length === 1 && fn.body.body[0].type === "ReturnStatement"
      ? fn.body.body[0].argument : fn.body;
    if (parameter?.type !== "Identifier" || body?.type !== "CallExpression") return;
    inputs.set(body, array.elements.map((item) => new Map(values).set(parameter.name, item)));
  });
  return inputs;
}

/** @param {string} file @param {object} tree @param {Set<string>} files @param {Function} report */
export function sourceReads(file, tree, files, report) {
  const { readers, namespaces, values, names } = bindings(tree);
  const inputs = literalMaps(tree, values, names);
  walk(tree, (node) => {
    if (node.type !== "CallExpression") return;
    const { callee } = node;
    const isRead = readers.has(callee.name)
      || (READ.test(member(callee) ?? "") && namespaces.has(callee.object?.name));
    if (!isRead) return;
    const paths = (inputs.get(node) ?? [values]).map((input) => pathValue(node.arguments[0], file, input));
    const production = paths.filter((path) => !path || !(FIXTURE.test(path) || (/\.[\w]+$/.test(path) && !SOURCE_EXTENSION.test(path))));
    if (!production.length) return;
    const line = node.loc.start.line;
    report("sourceRead", line);
    const candidates = new Set(production.filter(Boolean).flatMap((path) => [normalize(path), normalize(join(dirname(file), path))]));
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
