// @ts-check

import { dirname, join, normalize, relative } from "node:path/posix";
import { literal, member, SOURCE, TEST, walk } from "./syntax.mjs";

const FS = /^(?:node:)?fs(?:\/promises)?$/;
const READ = /^(?:readFile|readFileSync|createReadStream)$/;
const SOURCE_EXTENSION = /\.(?:[cm]?js|css|html|py|ts)$/i;
const FIXTURE = /(?:^|\/)(?:fixtures?|snapshots?|testdata)(?:\/|$)/;

/** @param {object} tree @param {string} file */
function bindings(tree, file) {
  const readers = new Set();
  const namespaces = new Set();
  const values = new Map();
  const names = new Map();
  const parents = new WeakMap();
  const harnesses = new Map();
  walk(tree, (node, parent) => {
    parents.set(node, parent);
    if (node.type === "Identifier") {
      if (!names.has(node.name)) names.set(node.name, []);
      names.get(node.name).push(node);
    }
    if (node.type === "ImportDeclaration" && normalize(join(dirname(file), node.source.value)) === "tests/lib/dom.mjs") {
      for (const specifier of node.specifiers) {
        if (specifier.imported?.name === "dom") harnesses.set(specifier.local.name, specifier);
      }
    }
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
  return { readers, namespaces, values, names, parents, harnesses };
}

/** @typedef {{ name: string, value: string }} MapInput */

/** @param {object} node @param {string} file @param {Map<string, object>} values @param {MapInput} [input] @param {Set<object>} [seen] */
function pathValue(node, file, values, input, seen = new Set()) {
  if (!node || seen.has(node)) return undefined;
  const visited = new Set(seen).add(node);
  const atom = literal(node);
  if (typeof atom === "string") return atom;
  if (node.type === "TemplateLiteral") {
    const parts = node.expressions.map((expression) => {
      if (expression.type === "Identifier" && expression.name === input?.name) return input.value;
      const value = literal(expression);
      return typeof value === "string" ? value : "*";
    });
    return node.quasis.map((part, index) => part.value.cooked + (parts[index] ?? "")).join("");
  }
  if (node.type === "Identifier") {
    if (node.name === input?.name) return input.value;
    return pathValue(values.get(node.name), file, values, undefined, visited);
  }
  const read = (part) => pathValue(part, file, values, input, visited);
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

/** @param {object} receiver @param {ReturnType<typeof bindings>} refs */
function mappedArray(receiver, { values, names, parents }) {
  if (receiver.type !== "Identifier") return receiver;
  const array = values.get(receiver.name);
  const declaration = array && parents.get(array);
  if (!declaration || !names.get(receiver.name).every((use) => {
    if (use === declaration.id) return true;
    const property = parents.get(use), call = property && parents.get(property);
    return property?.object === use && member(property) === "map" && call?.type === "CallExpression" && call.callee === property;
  })) return undefined;
  return array;
}

/** @param {object} tree @param {ReturnType<typeof bindings>} refs */
function literalMaps(tree, refs) {
  const inputs = /** @type {WeakMap<object, MapInput[]>} */ (new WeakMap());
  walk(tree, (node) => {
    if (node.type !== "CallExpression" || member(node.callee) !== "map") return;
    const array = mappedArray(node.callee.object, refs);
    if (array?.type !== "ArrayExpression" || array.elements.some((item) => typeof literal(item) !== "string")) return;
    const [fn] = node.arguments;
    if (!["ArrowFunctionExpression", "FunctionExpression"].includes(fn?.type)) return;
    const [parameter] = fn.params;
    const body = fn.body.type === "BlockStatement" && fn.body.body.length === 1 && fn.body.body[0].type === "ReturnStatement"
      ? fn.body.body[0].argument : fn.body;
    if (parameter?.type !== "Identifier" || body?.type !== "CallExpression") return;
    inputs.set(body, array.elements.map((item) => ({ name: parameter.name, value: literal(item) })));
  });
  return inputs;
}

/** @param {object} read @param {ReturnType<typeof bindings>} bindings */
function bootsDom(read, { parents, names, harnesses }) {
  const parent = parents.get(read);
  const value = parent?.type === "AwaitExpression" ? parent : read;
  const declaration = parents.get(value);
  let argument = value;
  if (declaration?.type === "VariableDeclarator" && parents.get(declaration)?.kind === "const") {
    const uses = names.get(declaration.id.name);
    if (uses?.length !== 2) return false;
    argument = uses.find((use) => use !== declaration.id);
  }
  const call = parents.get(argument);
  if (call?.type !== "CallExpression" || call.arguments[0] !== argument) return false;
  const name = call.callee.name;
  const specifier = harnesses.get(name);
  return !!specifier && names.get(name).every((use) => {
    const owner = parents.get(use);
    return owner === specifier || (owner?.type === "CallExpression" && owner.callee === use);
  });
}

/** @param {string} file @param {object} tree @param {Set<string>} files @param {Function} report */
export function sourceReads(file, tree, files, report) {
  const refs = bindings(tree, file);
  const { readers, namespaces, values } = refs;
  const inputs = literalMaps(tree, refs);
  walk(tree, (node) => {
    if (node.type !== "CallExpression") return;
    const { callee } = node;
    const isRead = readers.has(callee.name)
      || (READ.test(member(callee) ?? "") && namespaces.has(callee.object?.name));
    if (!isRead) return;
    const paths = (inputs.get(node) ?? [undefined]).map((input) => pathValue(node.arguments[0], file, values, input));
    const production = paths.filter((path) => !path || !(FIXTURE.test(path) || (/\.[\w]+$/.test(path) && !SOURCE_EXTENSION.test(path))));
    if (!production.length) return;
    if (production.every((path) => path && /\.html$/i.test(path)) && bootsDom(node, refs)) return;
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
