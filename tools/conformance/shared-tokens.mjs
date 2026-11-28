// @ts-check

const TABLE = "core/ui/tokens.css";
const references = value => [...value.matchAll(/\bvar\(\s*(--[\w-]+)/g)].map(match => match[1]);

/** @param {string} file @param {object} node */
export function declarationSite(file, node) {
  const context = [];
  for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) {
    context.unshift(parent.selector ?? `@${parent.name} ${parent.params}`);
  }
  return JSON.stringify(node.type === "rule" ? [file, ...context, node.selector] : [file, ...context, node.prop, node.value]);
}

/** @param {string[]} allowances */
export function tokenCensus(allowances = []) {
  const remaining = new Set(allowances);
  const table = new Map(), consumers = new Map(), aliases = new Map();
  const marked = new Set();
  const owner = file => file.startsWith("modules/") ? file.split("/").slice(0, 2).join("/") : file;
  function add(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }
  function sheet(file, tree, report) {
    tree.walkRules(rule => {
      if (remaining.delete(declarationSite(file, rule))) marked.add(rule);
      if (file === TABLE && /\.[a-z_-]/i.test(rule.selector)) report("componentTokenSelector", rule.source.start.line);
    });
    tree.walkDecls(decl => {
      const shared = file === TABLE && decl.prop.startsWith("--");
      if (shared && /^--(?:size-\d+(?:-|$)|[srh]-\d+-\d+(?:-|$))/.test(decl.prop)) {
        report("valueNamedToken", decl.source.start.line, decl.prop);
      }
      if (shared) table.set(decl.prop, decl.source.start.line);
      for (const key of references(decl.value)) {
        if (shared) add(aliases, key, decl.prop);
        else add(consumers, key, owner(file));
      }
      if (!decl.prop.startsWith("--")) return;
      if (remaining.delete(declarationSite(file, decl))) marked.add(decl);
      else if (file.startsWith("modules/") && decl.parent.selector === ":root" && !decl.value.includes("var(")) {
        report("localTokenLiteral", decl.source.start.line, declarationSite(file, decl));
      }
    });
  }
  function script(file, source) {
    for (const match of source.matchAll(/(?:var\(\s*|(?:getPropertyValue|space)\(\s*["'`])(--[\w-]+)/g)) {
      add(consumers, match[1], owner(file));
    }
  }
  function finish(report) {
    const pending = [...consumers.keys()];
    const dependencies = new Map();
    for (const [key, users] of aliases) for (const user of users) add(dependencies, user, key);
    while (pending.length) {
      const user = pending.pop();
      for (const key of dependencies.get(user) ?? []) {
        const before = consumers.get(key)?.size ?? 0;
        for (const place of consumers.get(user)) add(consumers, key, place);
        if (consumers.get(key).size > before) pending.push(key);
      }
    }
    for (const [name, line] of table) {
      if ((consumers.get(name)?.size ?? 0) >= 2) continue;
      if (!remaining.delete(name)) report(TABLE, "singleOwnerToken", line, name);
    }
    for (const unused of remaining) report(TABLE, "staleTokenAllowance", 1, unused);
  }
  return { sheet, script, finish, marked };
}
