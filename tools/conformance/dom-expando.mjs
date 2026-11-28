// @ts-check

import { bindingNames, literal, member, walk } from "./syntax.mjs";

const FUNCTION = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
const DOM_FACTORY = /^(?:querySelector|getElementById|createElement(?:NS)?|closest|cloneNode)$/;
const DOM_EDGE = /^(?:body|documentElement|activeElement|firstElementChild|lastElementChild|parentElement)$/;
const DOM_TYPE = /(?:^|\W)(?:\w*Element|Node|Document|Window)(?:$|\W)/;
const DOM_PROPERTIES = new Set(`
  accessKey ariaHidden ariaLabel ariaPressed async autocomplete checked className contentEditable controls
  currentTime defaultValue disabled draggable hidden href id inert innerHTML innerText max min multiple
  name muted onblur onchange onclick onclose onerror onfocus oninput onkeydown onload onpointerdown
  onpointermove onpointerup onscroll onsubmit open outerHTML placeholder poster preload readOnly rel
  required role rows scrollLeft scrollTop selected selectedIndex selectionEnd selectionStart size
  spellcheck src srcdoc step tabIndex target textContent title type value volume width height
`.trim().split(/\s+/));

/** @param {object[]} comments @param {string} source @param {number} start */
function nearestDoc(comments, source, start) {
  let low = 0;
  let high = comments.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (comments[middle].end <= start) low = middle + 1;
    else high = middle;
  }
  const candidate = comments[low - 1];
  if (!candidate?.value.startsWith("*")) return undefined;
  const gap = source.slice(candidate.end, start);
  if (/^\s*(?:export\s+|default\s+|(?:const|let|var)\s+\w+\s*=\s*)*$/.test(gap)) return candidate;
}

/** @param {object} tree @param {object[]} comments @param {string} source */
export function domWrites(tree, comments, source) {
  const top = { bindings: new Map(), parent: null, functionScope: true };
  const scopes = new WeakMap();
  const declarations = new Map();
  const mutations = [];
  const mark = (scope, pattern, kind, init) => {
    for (const name of bindingNames(pattern)) scope.bindings.set(name, { kind, init, scope });
  };
  walk(tree, (node, parent) => {
    let scope = scopes.get(parent) ?? top;
    if (FUNCTION.test(node.type)) {
      if (node.type === "FunctionDeclaration") mark(scope, node.id, "plain");
      scope = { bindings: new Map(), parent: scope, functionScope: true };
      const docs = nearestDoc(comments, source, node.start);
      const types = new Set([...docs?.value.matchAll(/@param\s*\{([^{}]*)\}\s*\[?([\w$]+)/g) ?? []]
        .filter(([, type]) => DOM_TYPE.test(type)).map(([, , key]) => key));
      for (const param of node.params) {
        mark(scope, param, param.type === "Identifier" && types.has(param.name) ? "dom" : "unknown");
      }
      if (node.type === "FunctionExpression") mark(scope, node.id, "plain");
    } else if (node.type === "BlockStatement" || /^(?:CatchClause|For(?:In|Of)?Statement|SwitchStatement)$/.test(node.type)) {
      scope = { bindings: new Map(), parent: scope, functionScope: false };
      if (node.type === "CatchClause") mark(scope, node.param, "plain");
    }
    scopes.set(node, scope);
    if (node.type === "VariableDeclarator") {
      let owner = scope;
      while (parent.kind === "var" && !owner.functionScope) owner = owner.parent;
      mark(owner, node.id, "unknown", node.id.type === "Identifier" ? node.init : null);
    }
    if (node.type === "ClassDeclaration") mark(scope, node.id, "plain");
    if (node.type === "ImportDeclaration") {
      const domModule = /(?:^|\/)(?:dom|ui|index)\.js$/.test(node.source.value);
      for (const specifier of node.specifiers) {
        const imported = specifier.imported?.name;
        mark(scope, specifier.local, domModule && imported === "$" ? "selector" : "unknown");
      }
    }
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression") mutations.push([node.left, scope]);
    if ((node.type === "UpdateExpression" || (node.type === "UnaryExpression" && node.operator === "delete"))
        && node.argument.type === "MemberExpression") mutations.push([node.argument, scope]);
    if (node.type === "CallExpression" && node.callee.object?.name === "Object"
        && ["assign", "defineProperty", "defineProperties"].includes(member(node.callee))) {
      declarations.set(node, scope);
    }
  });

  function lookup(scope, key) {
    for (let current = scope; current; current = current.parent) {
      if (current.bindings.has(key)) return current.bindings.get(key);
    }
    return { kind: ["document", "window"].includes(key) ? "dom" : "unknown" };
  }

  function infer(node, scope, seen = new Set()) {
    if (!node || seen.has(node)) return "unknown";
    const visited = new Set(seen).add(node);
    if (node.type === "ChainExpression") return infer(node.expression, scope, visited);
    if (node.type === "ObjectExpression" || node.type === "ArrayExpression" || node.type === "ThisExpression") return "plain";
    if (node.type === "Identifier") {
      const binding = lookup(scope, node.name);
      return binding.init ? infer(binding.init, binding.scope, visited) : binding.kind;
    }
    if (node.type === "CallExpression") {
      if (lookup(scope, node.callee.name).kind === "selector" || DOM_FACTORY.test(member(node.callee) ?? "")) return "dom";
    }
    if (DOM_EDGE.test(member(node) ?? "")) return "dom";
    return "unknown";
  }

  const found = [];
  function inspect(receiver, field, scope, line) {
    if (typeof field !== "string") return;
    const kind = infer(receiver, scope);
    if (kind === "plain" || kind === "selector") return;
    if (/^_[a-z]/i.test(field) || (kind === "dom" && !DOM_PROPERTIES.has(field) && !(field in Object.prototype))) {
      found.push(line);
    }
  }
  for (const [mutation, scope] of mutations) inspect(mutation.object, member(mutation), scope, mutation.loc.start.line);
  for (const [call, scope] of declarations) {
    const [receiver, ...args] = call.arguments;
    if (infer(receiver, scope) !== "dom") continue;
    if (member(call.callee) === "defineProperty") inspect(receiver, literal(args[0]), scope, call.loc.start.line);
    else {
      for (const arg of args) {
        for (const property of arg?.properties ?? []) {
          const field = property.computed ? literal(property.key) : property.key?.name ?? literal(property.key);
          inspect(receiver, field, scope, property.loc.start.line);
        }
      }
    }
  }
  return found;
}
