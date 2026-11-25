// @ts-check

import { dirname, join } from "node:path/posix";
import { literal, member } from "./syntax.mjs";

const clearTimers = new Map([
  ["setTimeout", "clearTimeout"], ["setInterval", "clearInterval"], ["requestAnimationFrame", "cancelAnimationFrame"],
]);

/** @param {string} file @param {string} target */
const scopeModule = (file, target) => typeof target === "string" && target.startsWith(".")
  && join(dirname(file), target) === "core/kernel/scope.js";

/** @param {object} node @param {WeakMap<object, object>} parents */
function statement(node, parents) {
  let current = node;
  for (let parent = parents.get(current); parent; parent = parents.get(current)) {
    if (parent.type === "BlockStatement" || parent.type === "Program") {
      return { current, list: parent.body };
    }
    current = parent;
  }
}

/** @param {object} node @param {object} identifier @param {Function} binding */
const sameBinding = (node, identifier, binding) => node?.type === "Identifier" && node.name === identifier?.name
  && binding(node) === binding(identifier);

/** @param {string} file @param {Function} binding @param {WeakMap<object, object>} parents */
function scopeFactory(file, binding, parents) {
  return call => {
    if (call?.type !== "CallExpression" || call.callee.type !== "Identifier") return false;
    const imported = binding(call.callee);
    return imported?.type === "ImportSpecifier" && imported.imported.name === "createScope"
      && scopeModule(file, literal(parents.get(imported)?.source));
  };
}

/** @param {object} fn @param {object} receiver @param {string} file @param {object[]} comments @param {WeakMap<object, object>} parents */
function scopeParameter(fn, receiver, file, comments, parents) {
  if (!fn?.params?.some(param => param.type === "Identifier" && param.name === receiver.name)) return false;
  const owner = parents.get(fn);
  const start = (owner?.type === "ExportNamedDeclaration" ? owner : fn).loc.start.line;
  const doc = comments.find(comment => comment.loc.end.line === start - 1 && comment.value.startsWith("*"));
  if (!doc) return false;
  const pattern = /@param\s+\{ReturnType<typeof import\(["']([^"']+)["']\)\.createScope>\}\s+([\w$]+)/g;
  return [...doc.value.matchAll(pattern)].some(([, source, name]) => name === receiver.name && scopeModule(file, source));
}

/** @param {object} node @param {WeakMap<object, object>} parents */
function resourceBinding(node, parents) {
  let value = node;
  const property = parents.get(node);
  const rawKey = property?.type === "Property" && !property.computed && property.kind === "init" && property.value === node
    ? property.key.name ?? literal(property.key) : null;
  if (rawKey != null) {
    value = parents.get(property);
    if (value?.type !== "ObjectExpression") return null;
  }
  const decl = parents.get(value);
  if (decl?.type !== "VariableDeclarator" || decl.init !== value || decl.id.type !== "Identifier") return null;
  const declaration = parents.get(decl);
  if (declaration?.kind !== "const" || declaration.declarations.length !== 1) return null;
  return { identifier: decl.id, key: rawKey, declaration };
}

/** @param {string} file @param {Function} binding @param {WeakMap<object, object>} parents @param {object[]} comments @param {Function} [consumed] */
export function ownership(file, binding, parents, comments, consumed = () => false) {
  const createsScope = scopeFactory(file, binding, parents);

  function isScope(receiver, previous) {
    if (receiver?.type !== "Identifier") return false;
    const origin = binding(receiver);
    if (origin?.type === "VariableDeclarator" && parents.get(origin)?.kind === "const" && createsScope(origin.init)) return true;
    const assignment = previous?.type === "ExpressionStatement" ? previous.expression : null;
    if (assignment?.type === "AssignmentExpression" && assignment.operator === "="
        && origin && sameBinding(assignment.left, receiver, binding) && createsScope(assignment.right)) return true;
    return scopeParameter(origin, receiver, file, comments, parents);
  }

  function ownsEffectCall(call) {
    return !call.optional && !call.callee.optional && member(call.callee) === "effect" && isScope(call.callee.object, null);
  }

  function returnsDisposer(resource, list, index) {
    const fn = parents.get(parents.get(resource.declaration));
    if (resource.key != null || fn?.type !== "FunctionDeclaration" || parents.get(fn)?.type !== "ExportNamedDeclaration") return false;
    const result = list.at(-1), dispose = result.type === "ReturnStatement" ? result.argument : null;
    const call = dispose?.type === "ArrowFunctionExpression" ? dispose.body : null;
    return call?.type === "CallExpression" && !call.optional && !call.callee.optional && member(call.callee) === "disconnect"
      && sameBinding(call.callee.object, resource.identifier, binding)
      && list.slice(index + 1, -1).every(node => node.type === "ExpressionStatement")
      && consumed(fn);
  }

  function ownsObserver(node) {
    const call = parents.get(node);
    const target = call?.type === "CallExpression" && !call.optional && !call.callee.optional
      && member(call.callee) === "observe" && call.arguments[0] === node;
    if (target) {
      const placement = statement(call, parents);
      if (!placement) return false;
      const { current, list } = placement;
      return isScope(call.callee.object, list[list.indexOf(current) - 1]);
    }
    const resource = resourceBinding(node, parents);
    if (!resource) return false;
    const placement = statement(resource.declaration, parents);
    if (!placement || placement.current !== resource.declaration) return false;
    const { list, current } = placement;
    const index = list.indexOf(current);
    const next = list[index + 1];
    const registration = next?.type === "ExpressionStatement" ? next.expression : null;
    if (registration?.type !== "CallExpression" || registration.optional || registration.callee.optional
        || member(registration.callee) !== "observe" || !isScope(registration.callee.object, list[index - 1])) {
      return returnsDisposer(resource, list, index);
    }
    const [argument] = registration.arguments;
    if (resource.key == null) return sameBinding(argument, resource.identifier, binding);
    return member(argument) === resource.key && sameBinding(argument.object, resource.identifier, binding);
  }

  function ownsListener(node) {
    const options = node.arguments[2];
    if (options?.type !== "ObjectExpression" || options.properties.some(property => property.type !== "Property"
        || property.computed || property.kind !== "init")) return false;
    const signals = options.properties.filter(property => (property.key.name ?? literal(property.key)) === "signal");
    return signals.length === 1 && member(signals[0].value) === "signal" && isScope(signals[0].value.object, null);
  }

  function ownsTimer(node, name, globalName) {
    const resource = resourceBinding(node, parents);
    if (!resource || resource.key != null) return false;
    const block = parents.get(resource.declaration);
    const effect = parents.get(block), call = parents.get(effect);
    if (block?.type !== "BlockStatement" || block.body.length !== 2 || block.body[0] !== resource.declaration
        || effect?.type !== "ArrowFunctionExpression" || effect.async
        || call?.type !== "CallExpression" || call.optional || call.callee.optional || call.arguments[0] !== effect) return false;
    const localEffect = file === "core/kernel/scope.js" && call.callee.name === "effect"
      && binding(call.callee)?.type === "FunctionDeclaration";
    if (!localEffect && !ownsEffectCall(call)) return false;
    const finish = block.body[1];
    const clear = finish.type === "ReturnStatement" && finish.argument?.type === "ArrowFunctionExpression" && finish.argument.body;
    return clear?.type === "CallExpression" && globalName(clear.callee, binding) === clearTimers.get(name)
      && sameBinding(clear.arguments[0], resource.identifier, binding);
  }

  return { ownsObserver, ownsListener, ownsTimer, ownsEffectCall };
}
