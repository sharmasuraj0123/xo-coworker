// @ts-check
import { isReference, lexicalBindings } from "./bindings.mjs";
import { javascript, walk } from "./syntax.mjs";

/** @param {string} source */
function measure(source) {
  const { tree } = javascript(source, "js/app.js");
  const { binding } = lexicalBindings(tree);
  let keys = 0, references = 0;
  walk(tree, (node, parent) => {
    if (node.type === "ObjectExpression") keys += node.properties.length;
    if (isReference(node, parent) && binding(node)?.start > node.start) references++;
  });
  return { keys, references };
}

/** @param {string} previous @param {string} current */
export function wiringGrowth(previous, current) {
  if (previous === current) return [];
  const before = measure(previous), after = measure(current);
  const errors = [];
  if (after.keys > before.keys) errors.push(`js/app.js: dependency keys increased from ${before.keys} to ${after.keys}`);
  if (after.references > before.references) {
    errors.push(`js/app.js: forward references increased from ${before.references} to ${after.references}`);
  }
  return errors;
}
