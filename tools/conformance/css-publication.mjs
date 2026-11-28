// @ts-check

export const ORIGIN = "https://stylesheet.invalid";
const VERSION = "/v/<tree>";
export const PUBLISHED_PATH = String.raw`(?:js|css|fonts|presets|assets|core|shell|modules|apps-host|vendor)/[^\"]+|(?:boot\.js|favicon\.svg)`;
const PUBLISHED = new RegExp(`^(?:${PUBLISHED_PATH})(?![\\s\\S])`);
const IMPORT = /^(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')\s*([\s\S]*)$/i;

/** @param {string} params */
export function stylesheetImport(params) {
  const match = IMPORT.exec(params);
  if (!match) throw new Error(`Unsupported @import: ${params}`);
  const target = match.slice(1, 6).find(Boolean);
  const extra = match[6].trim();
  const layer = /^layer(?:\(([\w.-]+)\))?(?:\s+|$)/i.exec(extra);
  return { target, layer, condition: extra.slice(layer?.[0].length ?? 0).trim() };
}

/** @param {string} href @param {URL} entry */
export function publishedLink(href, entry) {
  return new URL(href.startsWith("./") && PUBLISHED.test(href.slice(2))
    ? `.${VERSION}/${href.slice(2)}` : href, entry);
}

/** @param {URL} url */
export function sourcePath(url) {
  const path = decodeURIComponent(url.pathname);
  if (!path.startsWith(VERSION + "/")) return path;
  const relative = path.slice(VERSION.length + 1);
  if (!PUBLISHED.test(relative)) throw new Error(`Stylesheet path is outside the published version tree: ${url.pathname}`);
  return "/" + relative;
}
