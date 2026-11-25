// @ts-check

import { tokenizer } from "acorn";
import { parseHTML } from "linkedom";

const REFERENCE = /(?:[\w-]+\.md\b|architecture\/|design-research\/|decision note|\bphase \d|\b[DP]\d+\b)/i;
const FINDING = /\bF\d+\b/;
const REVISION = /\b(?:on|at|commit) [\da-f]{7,40}\b|(?<![#/\w-])(?=[\da-f]*\d)[\da-f]{7,40}\b/i;
const CHANGELOG = /\b(?:Astra|grader|Codex|the owner)\b|\bQA\s*#\d|\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
const TYPE_TAG = /@(?:arg(?:ument)?|param|returns?|type|typedef|property|prop|this|extends|implements|satisfies|throws|enum|template)\b\s*(?:[^{}\n]*?)\{/g;

/** @param {string} source @param {number} offset */
function lineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

/** @param {string} source */
export function htmlComments(source) {
  const { document } = parseHTML(source);
  const comments = [];
  const cursor = document.createTreeWalker(document, 128);
  let from = 0;
  while (cursor.nextNode()) {
    const value = cursor.currentNode.data;
    const offset = source.indexOf(`<!--${value}-->`, from);
    const line = offset < 0 ? 1 : lineAt(source, offset);
    comments.push({ value, startLine: line, endLine: line + value.split("\n").length - 1 });
    if (offset >= 0) from = offset + value.length + 7;
  }
  return comments;
}

/** @param {string} source @param {Function} report @param {number} line */
function countAny(source, report, line) {
  const tokens = [...tokenizer(source, { ecmaVersion: "latest" })];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type.label !== "name" || token.value !== "any") continue;
    if ([":", "?"].includes(tokens[index + 1]?.type.label)) continue;
    if ([".", "typeof"].includes(tokens[index - 1]?.type.label)) continue;
    report("explicitAny", line + lineAt(source, token.start) - 1);
  }
}

/** @param {object[]} tokens @param {Function} report */
export function declarationAny(tokens, report) {
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type.label !== "name" || token.value !== "any") continue;
    if ([":", "?", "="].includes(tokens[index + 1]?.type.label)) continue;
    if ([".", "typeof"].includes(tokens[index - 1]?.type.label)) continue;
    if (["interface", "type", "class", "function", "const", "let", "var"].includes(tokens[index - 1]?.value)) continue;
    report("explicitAny", token.loc.start.line);
  }
}

/** @param {string} value @param {number} startLine @param {Function} report */
function jsdocAny(value, startLine, report) {
  for (const match of value.matchAll(TYPE_TAG)) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    for (const token of tokenizer(value.slice(start), { ecmaVersion: "latest" })) {
      const label = token.type.label;
      if (label === "{") depth++;
      if (label === "}" && --depth === 0) {
        const body = value.slice(start + 1, start + token.start).replace(/^([ \t]*)\*/gm, "$1");
        countAny(body, report, startLine + lineAt(value, start) - 1);
        break;
      }
    }
  }
}

/** @param {object[]} comments @param {Function} report @param {boolean} jsdoc */
export function commentRules(comments, report, jsdoc) {
  let previousEnd = -1;
  for (const { value, startLine, endLine } of comments) {
    if (value.startsWith("!")) continue;
    const lines = value.split("\n");
    const startsRun = startLine > previousEnd + 1;
    for (let index = 0; index <= endLine - startLine; index++) {
      const line = startLine + index;
      if (index > 0 || (!startsRun && line > previousEnd)) report("commentLines", line);
      if (REFERENCE.test(lines[index])) report("commentReference", line);
      if ([CHANGELOG, FINDING, REVISION].some((pattern) => pattern.test(lines[index]))) report("changelogComment", line);
    }
    previousEnd = endLine;
    if (jsdoc && value.startsWith("*")) jsdocAny(value, startLine, report);
  }
}
