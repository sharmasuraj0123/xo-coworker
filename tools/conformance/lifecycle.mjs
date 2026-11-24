// @ts-check

import { javascript, member, walk } from "./syntax.mjs";

const globals = new Set(["document", "window", "globalThis", "self"]);
const observers = new Set(["ResizeObserver", "IntersectionObserver", "MutationObserver"]);
const timers = new Set(["setTimeout", "setInterval", "requestAnimationFrame"]);
const storage = new Set(["localStorage", "sessionStorage"]);

/** @param {object} node */
function globalName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && globals.has(node.object.name)) return member(node);
}

/** @param {string} file */
export function checksLifecycle(file) {
  return (file === "boot.js" || file === "js/app.js" || /^(modules|shell)\/.*\.m?js$/.test(file))
    && !file.split("/").includes("tests");
}

/** @param {object} node @param {string} source @param {(kind: string) => void} count */
export function lifecycleRule(node, source, count) {
  if (node.type === "NewExpression" && observers.has(globalName(node.callee))) count("observer");
  if (node.type === "CallExpression") {
    const { callee } = node;
    const timer = globalName(callee);
    if (timers.has(timer)) count(timer);
    if (member(callee) === "addEventListener" && ["document", "window"].includes(globalName(callee.object))) {
      count("globalListener");
    }
  }
  if (node.type === "CatchClause" && !node.body.body.length
      && source.slice(node.body.start + 1, node.body.end - 1).trim()) count("commentOnlyCatch");
  if (node.type === "Identifier" && storage.has(node.name)) count("storage");
  if (node.type === "MemberExpression" && node.computed && storage.has(globalName(node))) count("storage");
}

/** @param {string} source */
export function lifecycleCounts(source) {
  const { tree } = javascript(source, "fixture.mjs");
  const counts = {};
  walk(tree, (node) => lifecycleRule(node, source, (kind) => { counts[kind] = (counts[kind] || 0) + 1; }));
  return counts;
}
