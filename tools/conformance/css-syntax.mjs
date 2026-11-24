// @ts-check

import { createHash } from "node:crypto";
import { parse } from "postcss";

const BROWSER_IGNORED = new Set([
  "83f8f13dd28a4ed3975d2978155520d605ee41579330a0464d4a6e72b04e95b4",
  "4d761fdc17592a3b7b84a1a8853f7be2f480332be4c056ae7590268678b24332",
]);

/** @param {string} source @param {string} file @param {(line: number) => void} ignored */
export function cssSyntax(source, file, ignored) {
  const cleaned = source.replace(/\{\s*(\([^{};]+;)(?=\s*\})/g, (match, fragment, offset) => {
    if (!BROWSER_IGNORED.has(createHash("sha256").update(fragment).digest("hex"))) return match;
    const start = match.length - fragment.length;
    ignored(source.slice(0, offset + start).split("\n").length);
    return match.slice(0, start) + fragment.replace(/[^\r\n]/g, " ");
  });
  return parse(cleaned, { from: file });
}
