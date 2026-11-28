// @ts-check

import { bindingNames, walk } from "./syntax.mjs";

const FUNCTION = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
const BLOCK = /^(?:BlockStatement|CatchClause|For(?:In|Of)?Statement|SwitchStatement|StaticBlock)$/;
const CLASS = /^(?:ClassDeclaration|ClassExpression)$/;

/** @param {object} tree */
export function lexicalBindings(tree) {
  const root = { bindings: new Map(), outer: null, functionScope: true };
  const scopes = new WeakMap();
  const parents = new WeakMap();
  const bind = (scope, pattern, declaration) => {
    for (const name of bindingNames(pattern)) scope.bindings.set(name, declaration);
  };
  walk(tree, (node, parent) => {
    if (parent) parents.set(node, parent);
    let scope = scopes.get(parent) ?? root;
    if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") bind(scope, node.id, node);
    if (FUNCTION.test(node.type) || BLOCK.test(node.type) || CLASS.test(node.type)) {
      const functionScope = FUNCTION.test(node.type) || node.type === "StaticBlock"
        || node.type === "BlockStatement" && FUNCTION.test(parent?.type) && parent.body === node;
      scope = { bindings: new Map(), outer: scope, functionScope };
    }
    if (FUNCTION.test(node.type)) {
      if (node.type === "FunctionExpression") bind(scope, node.id, node);
      for (const parameter of node.params) bind(scope, parameter, node);
    }
    if (CLASS.test(node.type)) bind(scope, node.id, node);
    if (node.type === "CatchClause") bind(scope, node.param, node);
    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) bind(scope, specifier.local, specifier);
    }
    if (node.type === "VariableDeclarator") {
      let owner = scope;
      while (parent.kind === "var" && !owner.functionScope) owner = owner.outer;
      bind(owner, node.id, node);
    }
    scopes.set(node, scope);
  });
  const binding = (node) => {
    for (let scope = scopes.get(node); scope; scope = scope.outer) {
      if (scope.bindings.has(node.name)) return scope.bindings.get(node.name);
    }
    return null;
  };
  return { binding, parents };
}

/** @param {object} node @param {object} parent */
export function isReference(node, parent) {
  if (node.type !== "Identifier") return false;
  if (!parent) return true;
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return false;
  if (["Property", "MethodDefinition", "PropertyDefinition"].includes(parent.type)
      && parent.key === node && !parent.computed) return false;
  if (parent.type === "ExportSpecifier" && parent.exported === node) return false;
  if (["LabeledStatement", "BreakStatement", "ContinueStatement"].includes(parent.type) && parent.label === node) return false;
  if (parent.type === "MetaProperty" || parent.type.startsWith("Import") && parent.type !== "ImportExpression") return false;
  return true;
}
