// @ts-check

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commentRules, declarationAny, htmlComments, shellComments } from "./comments.mjs";
import { tokenCensus } from "./shared-tokens.mjs";
import { cssRules } from "./css.mjs";
import { checkDialogMarkup } from "./dialogs.mjs";
import { cssSyntax } from "./css-syntax.mjs";
import { moduleEdges, unusedExports } from "./exports.mjs";
import { javascriptRules } from "./javascript.mjs";
import { scopeConsumers } from "./scope-consumers.mjs";
import { declarationSyntax, javascript, JS, SOURCE, TEST } from "./syntax.mjs";

const ROOT_FILES = ["boot.js", "index.html", "serve.py"];
const ROOT_DIRS = ["js", "css", "core", "shell", "modules", "apps-host", "serve", "tests", "tools", "e2e"];
const EXCLUDED = new Set(["vendor", "node_modules", "__pycache__", "baselines", "fixtures", "testdata"]);
const GENERATED = new Set(["core/ui/icons/xoicons.js", "css/flavours.css", "css/flavour-swatches.css"]);
const HANDWRITTEN_LIMIT = 140;

/** @param {string} root */
export function conformanceFiles(root) {
  function* walk(dir) {
    if (!existsSync(join(root, dir))) return;
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (EXCLUDED.has(entry.name)) continue;
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) yield* walk(file);
      else if (entry.isFile() && /\.(?:[cm]?js|d\.ts|css|py|html|sh)$/.test(entry.name)) yield file;
    }
  }
  const scripts = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith(".sh"));
  return [...ROOT_FILES.filter((file) => existsSync(join(root, file))), ...scripts.map(entry => entry.name),
    ...ROOT_DIRS.flatMap((dir) => [...walk(dir)])].sort();
}

/** @param {object} comment */
const acornComment = (comment) => ({
  value: comment.value, startLine: comment.loc.start.line, endLine: comment.loc.end.line,
});

/** @param {string} root @param {string[]} files */
function pythonComments(root, files) {
  if (!files.length) return {};
  const scanner = fileURLToPath(new URL("./python-comments.py", import.meta.url));
  const result = spawnSync("python3", [scanner, root], {
    input: JSON.stringify(files), encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr ?? "Python comment scan failed");
  return JSON.parse(result.stdout);
}

/** @param {string} root @param {string[]} [files] */
export function inventory(root, files = conformanceFiles(root)) {
  const baseline = join(root, "tools/baselines/token-ownership.json");
  const census = tokenCensus(existsSync(baseline) ? JSON.parse(readFileSync(baseline, "utf8")) : []);
  const sourceFiles = new Set(files);
  const consumers = scopeConsumers(root, files);
  const python = pythonComments(root, files.filter((file) => file.endsWith(".py")));
  const graph = new Map();
  const findings = [];
  const add = (file, rule, line, note = "") => findings.push({ file, rule, line, note });
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    if (SOURCE.test(file) && !TEST.test(file) && /\.(?:m?js|html)$/.test(file)) census.script(file, source);
    const lines = source.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const report = (rule, line, target) => add(target ?? file, rule, line, target ? file : "");
    if (SOURCE.test(file) && !TEST.test(file) && !GENERATED.has(file)) {
      for (const [index, line] of lines.entries()) {
        if ([...line].length > HANDWRITTEN_LIMIT) report("lineLength", index + 1);
      }
      if (JS.test(file) && !/^\s*\/\/\s*@ts-check\b/.test(source)) report("missingTsCheck", 1);
    }
    try {
      if (JS.test(file)) {
        const syntax = javascript(source, file);
        graph.set(file, moduleEdges(file, syntax.tree));
        javascriptRules(file, source, syntax, report, sourceFiles, consumers);
        commentRules(syntax.comments.map(acornComment), report, true);
      } else if (file.endsWith(".d.ts")) {
        const { tokens, comments } = declarationSyntax(source);
        declarationAny(tokens, report);
        commentRules(comments.map(acornComment), report, true);
      } else if (file.endsWith(".css")) {
        const tree = cssSyntax(source, file, (line) => report("ignoredCss", line));
        const comments = [];
        tree.walkComments((node) => {
          comments.push({ value: node.text, startLine: node.source.start.line, endLine: node.source.end.line });
        });
        commentRules(comments, report, false);
        census.sheet(file, tree, (rule, line, detail) => add(file, rule, line, detail));
        cssRules(file, tree, report, census.marked);
      } else if (file.endsWith(".sh")) {
        commentRules(shellComments(source), report, false);
      } else {
        if (file.endsWith(".html") && SOURCE.test(file) && !TEST.test(file)) checkDialogMarkup(source, rule => report(rule, 1));
        commentRules(python[file] ?? htmlComments(source), report, false);
      }
    } catch (error) {
      throw new Error(`Cannot inspect ${file}: ${error.message}`, { cause: error });
    }
  }
  census.finish(add);
  unusedExports(graph, add);
  return findings;
}

/** @param {{file: string, rule: string}} finding */
export function family({ file, rule }) {
  const lifecycleCatch = rule === "commentOnlyCatch"
    && (file === "boot.js" || file === "js/app.js" || /^(modules|shell)\/.*\.m?js$/.test(file))
    && !file.split("/").includes("tests");
  if (["observer", "globalListener", "storage", "setTimeout", "setInterval", "requestAnimationFrame"].includes(rule)
      || lifecycleCatch) return "lifecycle";
  if (/^(?:px-|rawColor|themeSelector|widthMediaQuery|ignoredCss)/.test(rule)) return "style";
  if (/^(?:comment|changelog|explicitAny)/.test(rule)) return "hygiene";
  return "structure";
}
