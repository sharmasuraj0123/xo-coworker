// @ts-check

import { parse, tokenizer } from "acorn";

export const JS = /\.[cm]?js$/;
export const TEST = /(^|\/)tests\/|\.test\.[cm]?js$/;
export const SOURCE = /^(?:js|css|core|shell|modules|apps-host|serve)\/|^(?:boot\.js|index\.html|serve\.py)$/;

/** @param {string} source @param {string} file */
export function javascript(source, file) {
  const comments = [];
  const tree = parse(source, {
    ecmaVersion: "latest", sourceType: file.endsWith(".cjs") ? "script" : "module",
    locations: true, onComment: comments, allowHashBang: true,
  });
  return { tree, comments };
}

/** @param {string} source */
export function declarationSyntax(source) {
  const comments = [];
  const tokens = [...tokenizer(source, { ecmaVersion: "latest", locations: true, onComment: comments })];
  return { tokens, comments };
}

/** @param {object} node @param {(node: object, parent?: object) => void} visit @param {object} [parent] */
export function walk(node, visit, parent) {
  if (typeof node?.type !== "string") return;
  visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if ((key === "key" && node.shorthand) || key === "loc") continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node));
    else if (value && typeof value === "object") walk(value, visit, node);
  }
}

/** @param {object} node */
export function literal(node) {
  if (node?.type === "Literal") return node.value;
  if (node?.type === "TemplateLiteral" && !node.expressions.length) return node.quasis[0].value.cooked;
}

/** @param {object} node */
export function member(node) {
  if (node?.type === "MemberExpression") return node.computed ? literal(node.property) : node.property.name;
}

/** @param {object} node */
export function* bindingNames(node) {
  if (!node) return;
  switch (node.type) {
    case "Identifier": yield node.name; break;
    case "AssignmentPattern": yield* bindingNames(node.left); break;
    case "RestElement": yield* bindingNames(node.argument); break;
    case "ArrayPattern":
      for (const element of node.elements) yield* bindingNames(element);
      break;
    case "ObjectPattern":
      for (const property of node.properties) yield* bindingNames(property.value ?? property);
  }
}
