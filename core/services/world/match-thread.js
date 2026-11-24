// @ts-check

/** @param {{ title: string, sub?: string, summary?: string | null, branch?: string | null }} row @param {string[]} words @param {string} [sub] */
export function matchesThread({ title, summary, branch, sub: saved = "" }, words, sub = saved) {
  const text = `${title} ${sub} ${summary ?? ""} ${branch ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
}
