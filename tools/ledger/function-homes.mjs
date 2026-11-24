// @ts-check

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { javascript, walk } from "../conformance/syntax.mjs";

const root = process.argv[2];
const files = JSON.parse(readFileSync(0, "utf8"));
const found = {};
for (const file of files) {
  const names = new Set();
  try {
    const { tree } = javascript(readFileSync(resolve(root, file), "utf8"), file);
    walk(tree, (node) => {
      if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id) {
        names.add(node.id.name);
      }
      if (node.type === "VariableDeclarator" && node.id.type === "Identifier"
          && ["ArrowFunctionExpression", "FunctionExpression"].includes(node.init?.type)) names.add(node.id.name);
    });
  } catch (error) {
    if (!(error instanceof SyntaxError) && !error.code) throw error;
    found[file] = { error: error instanceof SyntaxError ? `cannot parse JavaScript: ${error.message}`
      : `cannot read JavaScript (${error.code})` };
    continue;
  }
  found[file] = { names: [...names] };
}
process.stdout.write(JSON.stringify(found));
