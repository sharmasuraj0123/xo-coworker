// @ts-check

import { isReference, lexicalBindings } from "./bindings.mjs";
import { ownership } from "./lifecycle-ownership.mjs";
import { javascript, member, walk } from "./syntax.mjs";

const globals = new Set(["document", "window", "globalThis", "self"]);
const observers = new Set(["ResizeObserver", "IntersectionObserver", "MutationObserver"]);
const timers = new Set(["setTimeout", "setInterval", "requestAnimationFrame"]);
const storage = new Set(["localStorage", "sessionStorage"]);

/** @param {object} node @param {ReturnType<typeof lexicalBindings>["binding"]} binding */
function globalName(node, binding) {
  if (node?.type === "Identifier" && !binding(node)) return node.name;
  if (node?.type === "ChainExpression") return globalName(node.expression, binding);
  if (node?.type === "MemberExpression" && globals.has(globalName(node.object, binding))) return member(node);
}

/** @param {string} file */
export function checksLifecycle(file) {
  return (file === "boot.js" || /^(?:apps-host|core|js|modules|shell)\/.*\.[cm]?js$/.test(file))
    && !/(^|\/)tests\/|\.test\.[cm]?js$/.test(file);
}

/** @param {object} node */
function passiveValue(node) {
  if (!node || ["Identifier", "Literal"].includes(node.type)) return true;
  if (node.type === "ArrayExpression") return node.elements.every(passiveValue);
  if (node.type === "ObjectExpression") {
    return node.properties.every(item => item.type === "Property" && item.kind === "init"
      && !item.computed && passiveValue(item.value));
  }
  if (node.type === "UnaryExpression" && node.operator === "void") return passiveValue(node.argument);
  return false;
}

/** @param {object} body */
function swallows(body) {
  if (body.type !== "BlockStatement") return passiveValue(body);
  return body.body.every(stmt => stmt.type === "EmptyStatement" || stmt.type === "ReturnStatement" && passiveValue(stmt.argument));
}

/** @param {object} tree @param {string} file @param {(kind: string, line: number) => void} report @param {object[]} [comments] @param {Function} [consumers] */
export function lifecycleRules(tree, file, report, comments = [], consumers = () => false) {
  const { binding, parents } = lexicalBindings(tree);
  const consumed = (fn) => {
    let localRead = false;
    walk(tree, (node, parent) => {
      if (isReference(node, parent) && node !== fn.id && binding(node) === fn) localRead = true;
    });
    return !localRead && consumers(file, fn.id.name);
  };
  const { ownsObserver, ownsListener, ownsTimer } = ownership(file, binding, parents, comments, consumed);
  walk(tree, (node, parent) => {
    const count = (kind) => report(kind, node.loc.start.line);
    if (node.type === "NewExpression" && observers.has(globalName(node.callee, binding)) && !ownsObserver(node)) count("observer");
    if (node.type === "CallExpression") {
      const target = globalName(node.callee, binding);
      if (target === "addEventListener" && !ownsListener(node)) count("globalListener");
      if (timers.has(target) && !ownsTimer(node, target, globalName)) count(target);
      const [handler] = node.arguments;
      if (member(node.callee) === "catch" && (handler?.type === "ArrowFunctionExpression" || handler?.type === "FunctionExpression")
          && swallows(handler.body)) count("commentOnlyCatch");
    }
    if (node.type === "CatchClause" && swallows(node.body)) count("commentOnlyCatch");
    if (file !== "core/platform/storage.js" && (node.type === "MemberExpression" || isReference(node, parent))
        && storage.has(globalName(node, binding))) count("storage");
  });
}

/** @param {string} source */
export function lifecycleCounts(source) {
  const { tree } = javascript(source, "fixture.mjs");
  const counts = {};
  lifecycleRules(tree, "fixture.mjs", (kind) => { counts[kind] = (counts[kind] || 0) + 1; });
  return counts;
}
