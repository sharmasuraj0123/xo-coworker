// @ts-check

import { parse } from "acorn";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const globals = new Set(["document", "window", "globalThis", "self"]);
const observers = new Set(["ResizeObserver", "IntersectionObserver", "MutationObserver"]);
const timers = new Set(["setTimeout", "setInterval", "requestAnimationFrame"]);
const storage = new Set(["localStorage", "sessionStorage"]);

/** @param {any} node */
function propertyName(node) {
  return node.computed ? node.property.value : node.property.name;
}

/** @param {any} node */
function globalName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && globals.has(node.object.name)) return propertyName(node);
}

/** @param {string} file */
export function checksLifecycle(file) {
  return (file === "boot.js" || file === "js/app.js" || /^(modules|shell)\/.*\.m?js$/.test(file))
    && !file.split("/").includes("tests");
}

/** @param {string} source */
export function lifecycleCounts(source) {
  const tree = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  /** @type {Record<string, number>} */
  const counts = {};
  /** @param {string} kind */
  const count = (kind) => { counts[kind] = (counts[kind] || 0) + 1; };

  /** @param {any} node */
  function visit(node) {
    if (!node?.type) return;
    if (node.type === "NewExpression" && observers.has(globalName(node.callee))) count("observer");
    if (node.type === "CallExpression") {
      const { callee } = node;
      const timer = globalName(callee);
      if (timers.has(timer)) count(timer);
      if (callee.type === "MemberExpression" && propertyName(callee) === "addEventListener"
          && ["document", "window"].includes(globalName(callee.object))) count("globalListener");
    }
    if (node.type === "CatchClause" && !node.body.body.length
        && source.slice(node.body.start + 1, node.body.end - 1).trim()) count("commentOnlyCatch");
    if (node.type === "Identifier" && storage.has(node.name)) count("storage");
    if (node.type === "MemberExpression" && node.computed && storage.has(globalName(node))) count("storage");
    if (node.type === "Property" && node.shorthand) { visit(node.value); return; }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  }

  visit(tree);
  return counts;
}

/** @param {string[]} files @param {string} root @param {string} basePath @param {boolean} update */
export function checkLifecycle(files, root, basePath, update) {
  if (!existsSync(basePath)) return "Missing lifecycle baseline";
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  const errors = [];
  /** @type {Record<string, Record<string, number>>} */
  const smaller = {};
  for (const file of files.filter(checksLifecycle).sort()) {
    const current = lifecycleCounts(readFileSync(join(root, file), "utf8"));
    for (const [kind, count] of Object.entries(current)) {
      const allowed = base[file]?.[kind] || 0;
      if (count > allowed) errors.push(`  ${file}: ${kind} grew from ${allowed} to ${count}`);
      if (allowed) (smaller[file] ||= {})[kind] = Math.min(count, allowed);
    }
  }
  if (errors.length) return `Use lifecycle scopes, shared storage, or explicit error handling:\n${errors.join("\n")}`;
  if (update) writeFileSync(basePath, JSON.stringify(smaller, null, 1) + "\n");
  return null;
}
