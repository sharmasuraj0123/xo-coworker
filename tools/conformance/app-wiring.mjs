// @ts-check
import { isReference, lexicalBindings } from "./bindings.mjs";
import { javascript, walk } from "./syntax.mjs";

/** @param {ReturnType<typeof javascript>["tree"]} tree */
function staticBoot(tree) {
  const imports = tree.body.filter((statement) => statement.type === "ImportDeclaration");
  const boot = imports.find((statement) => statement.source.value === "../shell/boot.js")
    ?.specifiers.find((item) => item.type === "ImportSpecifier" && item.imported.name === "bootShell");
  if (!boot) return undefined;
  if (imports.some((statement) => !statement.specifiers.length)) return false;
  const body = tree.body.filter((statement) => statement.type !== "ImportDeclaration");
  const invocation = body[0]?.type === "ExportDefaultDeclaration" ? body[0].declaration : body[0]?.expression;
  if (body.length !== 1 || invocation?.type !== "AwaitExpression") return false;
  const call = invocation.argument;
  if (call.type !== "CallExpression" || call.callee.name !== boot.local.name || call.arguments.length !== 1) return false;
  const modules = call.arguments[0], names = new Set(imports.flatMap((statement) => statement.specifiers.map((item) => item.local.name)));
  return modules.type === "ArrayExpression" && modules.elements.every((item) => item?.type === "Identifier" && names.has(item.name));
}

/** @param {string} source */
function measure(source) {
  const { tree } = javascript(source, "js/app.js");
  const { binding } = lexicalBindings(tree);
  let keys = 0, references = 0;
  walk(tree, (node, parent) => {
    if (node.type === "ObjectExpression") keys += node.properties.length;
    if (isReference(node, parent) && binding(node)?.start > node.start) references++;
  });
  return { keys, references, boot: staticBoot(tree) };
}

/** @param {string} previous @param {string} current */
export function wiringGrowth(previous, current) {
  if (previous === current) return [];
  const before = measure(previous), after = measure(current);
  const errors = [];
  if ((before.boot !== undefined || after.boot !== undefined) && after.boot !== true) {
    errors.push("js/app.js: boot must receive a static list of imported modules");
  }
  if (after.keys > before.keys) errors.push(`js/app.js: dependency keys increased from ${before.keys} to ${after.keys}`);
  if (after.references > before.references) {
    errors.push(`js/app.js: forward references increased from ${before.references} to ${after.references}`);
  }
  return errors;
}

const firstPaint = new Set(["shell/frame.js", "modules/home/skeleton.js"]);
const setup = new Set(["createKernel", "createShellKernel", "definePlaces", "addEventListener", "listen", "observe", "setRich", "register", "captureCoderToken"]);

/** @param {string} file @param {object} tree @param {Function} report */
export function importEffects(file, tree, report) {
  if (!/^(core|modules|shell)\//.test(file) || firstPaint.has(file)) return;
  const names = new Map();
  for (const node of tree.body) {
    if (node.type === "ImportDeclaration") {
      for (const spec of node.specifiers) names.set(spec.local.name, spec.imported?.name ?? spec.local.name);
    } else if (node.type === "VariableDeclaration" || node.type === "ExportNamedDeclaration") {
      for (const decl of (node.declaration ?? node).declarations ?? []) inspect(decl.init);
    } else if (!["FunctionDeclaration", "ClassDeclaration", "ExportAllDeclaration"].includes(node.type)) {
      report("importEffect", node.loc.start.line);
    }
  }
  function inspect(node) {
    if (!node || typeof node !== "object" || /^(ArrowFunction|Function|Class)/.test(node.type)) return;
    if (node.type === "CallExpression") {
      const name = node.callee.name ?? node.callee.property?.name;
      if (setup.has(names.get(name) ?? name) || node.callee.type === "ArrowFunctionExpression" || node.callee.type === "FunctionExpression") {
        report("importEffect", node.loc.start.line);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc") continue;
      if (Array.isArray(value)) value.forEach(inspect);
      else inspect(value);
    }
  }
}
