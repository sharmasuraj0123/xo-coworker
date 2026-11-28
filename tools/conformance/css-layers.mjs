// @ts-check

/** @param {object[]} rows */
export function layersIn(rows) {
  const registered = new Set();
  let anonymous = 0;
  return (name, context) => {
    const parent = context.findLast((scope) => scope.at === "layer")?.params;
    const conditions = context.filter((scope) => scope.at !== "layer");
    const segments = name ? name.split(".") : [`#${++anonymous}`];
    let path = parent;
    for (const segment of segments) {
      path = path ? `${path}.${segment}` : segment;
      const key = JSON.stringify([path, conditions]);
      if (registered.has(key)) continue;
      registered.add(key);
      rows.push({ context: conditions, at: "layer", params: path });
    }
    return { at: "layer", params: path };
  };
}
