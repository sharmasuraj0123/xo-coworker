// @ts-check

const ATTRIBUTE = /\[data-(theme|flavour)=(["'])([^"']+)\2\]/g;
const ROOT_SUFFIX = /(?:\[data-(?:theme|flavour)=(?:"[^"]+"|'[^']+')\]|:not\(\[data-theme=(?:"[^"]+"|'[^']+')\]\))/y;
const WIDTH = /\((min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\)/gi;
const CONTRAST = /\(prefers-contrast\s*:\s*more\)/i;

/** @param {string} selector */
function rootSelector(selector) {
  if (!selector.startsWith(":root")) return undefined;
  ROOT_SUFFIX.lastIndex = ":root".length;
  const tests = [];
  while (ROOT_SUFFIX.lastIndex < selector.length) {
    const match = ROOT_SUFFIX.exec(selector);
    if (!match) return undefined;
    const [, attribute, , value] = [...match[0].matchAll(ATTRIBUTE)][0];
    tests.push({ attribute, value, negate: match[0].startsWith(":not") });
  }
  return tests;
}

/** @param {string} query */
function mediaTests(query) {
  const sides = [...query.matchAll(WIDTH)];
  const contrast = CONTRAST.test(query);
  const remaining = query.replace(WIDTH, "").replace(CONTRAST, "").replace(/\band\b/gi, "").trim();
  if (remaining || (!sides.length && !contrast)) return undefined;
  const boundaries = sides.map(([, side, value]) => [side, Number(value)]);
  return { boundaries, contrast };
}

/** @param {object} row */
function rootDefinition(row) {
  if (!row.property?.startsWith("--")) return undefined;
  const selector = row.context.at(-1)?.selector;
  const selectors = selector?.split(",").map((item) => rootSelector(item.trim()));
  if (!selectors?.length || selectors.some((item) => !item)) return undefined;
  let layer;
  const media = [];
  for (const scope of row.context.slice(0, -1)) {
    if (scope.at === "layer" && scope.params && !scope.params.includes(".") && !layer) layer = scope.params;
    else if (scope.at === "media") {
      const tests = mediaTests(scope.params);
      if (!tests) return undefined;
      media.push(tests);
    } else return undefined;
  }
  return { row, selectors, layer, media };
}

/** @param {object[]} rows @param {Set<string>} runtime */
export function rootTokenModel(rows, runtime) {
  const shadowed = new Set(runtime);
  const definitions = [];
  const widths = new Set();
  const flavours = new Set([null]);
  const layers = new Map();
  let contrast = false;
  for (const row of rows) {
    for (const scope of row.context) {
      if (scope.at === "layer" && scope.params && !layers.has(scope.params)) layers.set(scope.params, layers.size);
      for (const [, key, , value] of (scope.selector ?? "").matchAll(ATTRIBUTE)) {
        if (key === "flavour") flavours.add(value);
      }
    }
    if (row.at === "layer") {
      for (const layer of row.params.split(",").map((item) => item.trim())) {
        if (!layers.has(layer)) layers.set(layer, layers.size);
      }
    }
    if (!row.property?.startsWith("--")) continue;
    const entry = rootDefinition(row);
    if (!entry) shadowed.add(row.property);
    else {
      definitions.push(entry);
      for (const query of entry.media) {
        for (const [, value] of query.boundaries) widths.add(value);
        contrast ||= query.contrast;
      }
    }
  }
  const ordered = [...widths].sort((a, b) => a - b);
  const widthsToCheck = ordered.length ? ordered.flatMap((width, index) => {
    const low = ordered[index - 1] ?? 0;
    return [(low + width) / 2, width];
  }).concat(ordered.at(-1) + 1) : [null];
  const contexts = [];
  const dependencies = new Map();
  for (const { row } of definitions) {
    const keys = dependencies.get(row.property) ?? new Set();
    for (const [, key] of row.value.matchAll(/\bvar\(\s*(--[\w-]+)/gi)) keys.add(key);
    dependencies.set(row.property, keys);
  }
  const validated = new Map();
  function safeToFold(key, active = new Set()) {
    if (!dependencies.has(key) || shadowed.has(key) || active.has(key)) return false;
    if (!validated.has(key)) {
      const visited = new Set(active).add(key);
      validated.set(key, [...dependencies.get(key)].every((dependency) => safeToFold(dependency, visited)));
    }
    return validated.get(key);
  }
  const safe = definitions.filter(({ row }) => safeToFold(row.property));
  for (const theme of ["dark", "light"]) {
    for (const flavour of flavours) {
      for (const width of widthsToCheck) {
        for (const moreContrast of contrast ? [false, true] : [false]) {
          const state = { theme, flavour, width, moreContrast };
          contexts.push({ state, values: winningValues(safe, layers, state) });
        }
      }
    }
  }
  return { folded: new Set(safe.map(({ row }) => row)), contexts };
}

/** @param {object[]} definitions @param {Map<string, number>} layers @param {object} state */
function winningValues(definitions, layers, state) {
  const winners = new Map();
  for (const { row, selectors, media, layer } of definitions) {
    const held = media.every((query) => (!query.contrast || state.moreContrast)
      && query.boundaries.every(([side, boundary]) => side === "min" ? state.width >= boundary : state.width <= boundary));
    if (!held) continue;
    const matching = selectors.filter((tests) => tests.every(({ attribute, value, negate }) =>
      negate ? state[attribute] !== value : state[attribute] === value));
    if (!matching.length) continue;
    const specificity = Math.max(...matching.map((tests) => tests.length));
    const rank = layer === undefined ? layers.size : layers.get(layer);
    const layerRank = row.important ? -rank : rank;
    const old = winners.get(row.property);
    const wins = !old || (row.important !== old.important ? row.important
      : layerRank !== old.layerRank ? layerRank > old.layerRank : specificity >= old.specificity);
    if (wins) winners.set(row.property, { value: row.value, important: row.important, layerRank, specificity });
  }
  return new Map([...winners].map(([key, item]) => [key, item.value]));
}
