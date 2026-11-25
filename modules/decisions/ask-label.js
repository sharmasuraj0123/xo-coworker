// @ts-check
import { esc } from "../../core/platform/util.js";
import { plainText } from "../../core/services/world/timeline.js";
import { renderInline } from "../../core/ui/markdown/markdown.js";
import { headOf } from "./cardparts.js";

/** @param {Parameters<typeof headOf>[0]} need */
export function askTitle(need) {
  const { verb, md, text } = headOf(need);
  return (verb ? esc(verb) + " " : "") + (md ? renderInline(text, true) : esc(text));
}

/** @param {Parameters<typeof headOf>[0]} need */
export function askShort(need) {
  const { verb, md, text } = headOf(need);
  return [verb, md ? plainText(text) : text].filter(Boolean).join(" ");
}
