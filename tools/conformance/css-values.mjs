// @ts-check

const TOKEN = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|#[\w-]+|[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?(?:[a-z]+|%)?|(?:[a-z_\u0080-\uFFFF-]|\\[\s\S])(?:[\w\u0080-\uFFFF-]|\\[\s\S])*|\s+|[^]/giy;

/** @param {string} value */
export function valueTokens(value) {
  return [...value.matchAll(TOKEN)].map((match) => ({ text: match[0], offset: match.index }));
}

/** @param {{text: string, offset: number}[]} tokens @param {number} open */
export function closingParen(tokens, open) {
  let depth = 0;
  for (let index = open; index < tokens.length; index++) {
    if (tokens[index].text === "(") depth++;
    if (tokens[index].text === ")" && --depth === 0) return index;
  }
  return -1;
}
