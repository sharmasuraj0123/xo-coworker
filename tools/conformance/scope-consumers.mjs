// @ts-check

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path/posix";
import { isReference, lexicalBindings } from "./bindings.mjs";
import { checksLifecycle } from "./lifecycle.mjs";
import { ownership } from "./lifecycle-ownership.mjs";
import { javascript, literal, walk } from "./syntax.mjs";

/** @param {string} root @param {string[]} files */
export function scopeConsumers(root, files) {
  const modules = new Map();
  const candidates = files.filter(checksLifecycle);
  return (provider, name) => {
    let uses = 0;
    for (const file of candidates) {
      if (file === provider) continue;
      if (!modules.has(file)) modules.set(file, { source: readFileSync(join(root, file), "utf8") });
      const entry = modules.get(file);
      if (!entry.source.includes(basename(provider)) && !/\\[ux]/.test(entry.source)) continue;
      entry.syntax ??= javascript(entry.source, file);
      const { tree, comments } = entry.syntax;
      const matches = (node) => {
        const target = literal(node.source);
        return typeof target === "string" && target.startsWith(".") && join(dirname(file), target) === provider;
      };
      const imports = new Set();
      for (const node of tree.body) {
        if (!matches(node)) continue;
        if (node.type === "ExportAllDeclaration") return false;
        if (node.type === "ExportNamedDeclaration" && node.specifiers.some(item => item.local.name === name)) return false;
        if (node.type !== "ImportDeclaration") continue;
        for (const item of node.specifiers) {
          if (item.type === "ImportNamespaceSpecifier") return false;
          if (item.imported?.name === name) imports.add(item);
        }
      }
      const { binding, parents } = lexicalBindings(tree);
      const { ownsEffectCall } = ownership(file, binding, parents, comments);
      let opaque = false;
      walk(tree, (node, parent) => {
        if (node.type === "ImportExpression" && matches(node)) opaque = true;
        if (!isReference(node, parent) || !imports.has(binding(node))) return;
        if (parent?.type === "CallExpression" && parent.arguments[0] === node && ownsEffectCall(parent)) uses++;
        else opaque = true;
      });
      if (opaque) return false;
    }
    return uses > 0;
  };
}
