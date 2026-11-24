// @ts-check

import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { parseHTML } from "linkedom";
import { cssSyntax } from "./css-syntax.mjs";
import { closingParen, valueTokens } from "./css-values.mjs";
import { ORIGIN, publishedLink, sourcePath, stylesheetImport } from "./css-publication.mjs";
import { layersIn } from "./css-layers.mjs";

const ENTRY = new URL("/index.html", ORIGIN);

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

/** @param {string} root @param {string} [entry] @param {(row: object, path: string) => void} [onDeclaration] */
export function flattenStyles(root, entry = "index.html", onDeclaration) {
  const base = new URL(entry, ENTRY);
  const rootPath = resolve(root);
  const { document } = parseHTML(readFileSync(resolve(rootPath, entry), "utf8"));
  if (document.querySelector("base[href]")) throw new Error("Stylesheet snapshot does not support an HTML base URL");
  const rows = [];
  const parsed = new Map();
  const active = new Set();
  const layer = layersIn(rows);

  function emit(nodes, url, context) {
    for (const node of nodes) {
      if (node.type === "comment") continue;
      if (node.type === "decl") {
        const value = rebaseUrls(node.value, url);
        const row = { context, property: node.prop, value, important: Boolean(node.important) };
        rows.push(row);
        onDeclaration?.(row, sourcePath(url));
      } else if (node.type === "rule") {
        emit(node.nodes, url, [...context, { selector: node.selector }]);
      } else if (node.type === "atrule" && node.name.toLowerCase() === "import") {
        const { target, layer: importedLayer, condition } = stylesheetImport(node.params);
        const scopes = importedLayer ? [...context, layer(importedLayer[1], context)] : [...context];
        if (condition) scopes.push({ at: "import-condition", params: condition });
        visit(new URL(target, url), scopes);
      } else if (node.type === "atrule" && node.name.toLowerCase() === "layer") {
        if (node.nodes) emit(node.nodes, url, [...context, layer(node.params.trim(), context)]);
        else for (const name of node.params.split(",")) layer(name.trim(), context);
      } else if (node.type === "atrule") {
        const at = { at: node.name.toLowerCase(), params: rebaseUrls(node.params, url) };
        if (node.nodes) emit(node.nodes, url, [...context, at]);
        else rows.push({ context, ...at });
      }
    }
  }

  function visit(url, context) {
    if (url.origin !== ORIGIN || active.has(url.pathname)) throw new Error(`External or cyclic stylesheet: ${url.href}`);
    const file = resolve(rootPath, "." + sourcePath(url));
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
    else visit(publishedLink(node.getAttribute("href"), base), context);
  }
  return rows;
}
