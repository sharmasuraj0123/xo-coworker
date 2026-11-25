// @ts-check

import { bindingNames, literal, member, SOURCE, TEST, walk } from "./syntax.mjs";
import { checksLifecycle, lifecycleRules } from "./lifecycle.mjs";
import { sourceReads } from "./source-reads.mjs";
import { domWrites } from "./dom-expando.mjs";

const FUNCTION = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
const VIEWPORT = /^(?:innerWidth|outerWidth|clientWidth)$/;
const MAX_FUNCTION_LINES = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {object} node @param {object} parent */
function topLevelFunction(node, parent) {
  return FUNCTION.test(node.type) && ["Program", "ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(parent?.type);
}

/** @param {string} file @param {string} source @param {object} syntax @param {Function} report @param {Set<string>} files */
export function javascriptRules(file, source, { tree, comments }, report, files) {
  const production = SOURCE.test(file) && !TEST.test(file);
  const lifecycle = checksLifecycle(file);
  const topLevelValues = new Set(tree.body.flatMap((item) =>
    (item.declaration ?? item).declarations?.map((decl) => decl.init) ?? []));
  if (lifecycle) lifecycleRules(tree, file, report);
  if (production) {
    for (const line of domWrites(tree, comments, source)) report("domExpando", line);
    for (const comment of comments) {
      if (/^\s*@ts-(?:nocheck|ignore|expect-error)\b/.test(comment.value)) {
        report("typeSuppression", comment.loc.start.line);
      }
    }
  }
  walk(tree, (node, parent) => {
    const count = (rule) => report(rule, node.loc.start.line);
    if (!lifecycle && production && node.type === "CatchClause" && !node.body.body.length
        && comments.some((comment) => comment.start > node.body.start && comment.end < node.body.end)) {
      count("commentOnlyCatch");
    }
    if (!production) return;
    if ((topLevelFunction(node, parent) || (FUNCTION.test(node.type) && topLevelValues.has(node)))
        && node.loc.end.line - node.loc.start.line + 1 > MAX_FUNCTION_LINES) count("functionLines");
    if (FUNCTION.test(node.type) && file.startsWith("modules/")) {
      for (const param of node.params) {
        if ([...bindingNames(param)].includes("S")) count("sharedStateParameter");
      }
    }
    if (node.type === "CallExpression" && file === "js/app.js" && /^create[A-Z]/.test(node.callee.name ?? "")) {
      for (const bag of node.arguments.filter((arg) => arg.type === "ObjectExpression")) {
        for (const property of bag.properties) report("dependencyKey", property.loc.start.line);
      }
    }
    if (node.type === "CallExpression" && (node.callee.name ?? member(node.callee)) === "matchMedia") {
      const query = literal(node.arguments[0]);
      if (typeof query === "string" && /\bwidth\b/i.test(query)) count("inlineViewportQuery");
    }
    if (node.type === "BinaryExpression" && /^(?:[<>]=?|[!=]==?)$/.test(node.operator)
        && [[node.left, node.right], [node.right, node.left]].some(([width, limit]) =>
          VIEWPORT.test(width.name ?? member(width) ?? "") && typeof literal(limit) === "number")) count("viewportLiteral");
    const dayOwner = file === "core/platform/calendar.js" && parent?.type === "VariableDeclarator"
      && parent.id.name === "DAY_MS" && parent.init === node && topLevelValues.has(node);
    if (node.type === "Literal" && node.value === DAY_MS && !dayOwner) count("dayLiteral");
  });
  if (TEST.test(file)) sourceReads(file, tree, files, report);
}
