// @ts-check

import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { parseHTML } from "linkedom";
import { cssSyntax } from "./css-syntax.mjs";
import { closingParen, valueTokens } from "./css-values.mjs";

const ORIGIN = "https://stylesheet.invalid";
const ENTRY = new URL("/index.html", ORIGIN);
const IMPORT = /^(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')\s*([\s\S]*)$/i;

/** @param {string} href @param {URL} from */
function assetUrl(href, from) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href;
  const url = new URL(href, from);
  return url.pathname + url.search + url.hash;
}

/** @param {string} value @param {URL} from */
function rebaseUrls(value, from) {
  const tokens = valueTokens(value);
  const parts = [];
  let offset = 0;
  for (let index = 0; index < tokens.length - 1; index++) {
    if (tokens[index].text.toLowerCase() !== "url" || tokens[index + 1].text !== "(") continue;
    const end = closingParen(tokens, index + 1);
    if (end === -1) continue;
    const start = tokens[index].offset;
    const argument = value.slice(tokens[index + 1].offset + 1, tokens[end].offset).trim();
    const quoted = /^(?:"([^"]+)"|'([^']+)')$/.exec(argument);
    const href = quoted?.[1] ?? quoted?.[2] ?? argument;
    if (href && !href.includes("\\")) {
      parts.push(value.slice(offset, start), `url(${JSON.stringify(assetUrl(href, from))})`);
      offset = tokens[end].offset + 1;
    }
    index = end;
  }
  return parts.join("") + value.slice(offset);
}

/** @param {string} root @param {string} [entry] */
export function flattenStyles(root, entry = "index.html") {
  const base = new URL(entry, ENTRY);
  const rootPath = resolve(root);
  const { document } = parseHTML(readFileSync(resolve(rootPath, entry), "utf8"));
  if (document.querySelector("base[href]")) throw new Error("Stylesheet snapshot does not support an HTML base URL");
  const rows = [];
  const parsed = new Map();
  const active = new Set();

  function emit(nodes, url, context) {
    for (const node of nodes) {
      if (node.type === "comment") continue;
      if (node.type === "decl") {
        const value = rebaseUrls(node.value, url);
        rows.push({ context, property: node.prop, value, important: Boolean(node.important) });
      } else if (node.type === "rule") {
        emit(node.nodes, url, [...context, { selector: node.selector }]);
      } else if (node.type === "atrule" && node.name.toLowerCase() === "import") {
        const match = IMPORT.exec(node.params);
        if (!match) throw new Error(`Unsupported @import: ${node.params}`);
        const target = match.slice(1, 6).find(Boolean);
        const extra = match[6].trim();
        const layer = /^layer(?:\(([\w.-]+)\))?(?:\s+|$)/i.exec(extra);
        const scopes = layer ? [...context, { at: "layer", params: layer[1] ?? "" }] : [...context];
        const media = extra.slice(layer?.[0].length ?? 0).trim();
        if (media) scopes.push({ at: "import-condition", params: media });
        visit(new URL(target, url), scopes);
      } else if (node.type === "atrule") {
        const at = { at: node.name.toLowerCase(), params: rebaseUrls(node.params, url) };
        if (node.nodes) emit(node.nodes, url, [...context, at]);
        else rows.push({ context, ...at });
      }
    }
  }

  function visit(url, context) {
    if (url.origin !== ORIGIN || active.has(url.pathname)) throw new Error(`External or cyclic stylesheet: ${url.href}`);
    const file = resolve(rootPath, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(rootPath + sep)) throw new Error(`Stylesheet escapes the source root: ${url.href}`);
    if (!parsed.has(file)) parsed.set(file, cssSyntax(readFileSync(file, "utf8"), file, () => {}));
    active.add(url.pathname);
    emit(parsed.get(file).nodes, url, context);
    active.delete(url.pathname);
  }

  for (const node of document.querySelectorAll('link[rel~="stylesheet"][href], style')) {
    const media = node.getAttribute("media");
    const context = media ? [{ at: "media", params: media }] : [];
    if (node.localName === "style") emit(cssSyntax(node.textContent, entry, () => {}).nodes, base, context);
    else visit(new URL(node.getAttribute("href"), base), context);
  }
  return rows;
}
