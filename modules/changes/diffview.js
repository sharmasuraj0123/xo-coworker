// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { reportFailure } from "../../core/platform/util.js";

/** @import { DiffOptions } from "./types.d.ts" */

/** @import { DiffWorkerPool, PierreDiffs, RenderedDiff } from "./pierre-types.d.ts" */

const LIB = new URL("../../vendor/pierre-diffs/diffs.js", import.meta.url).href;
const WORKER = new URL("../../vendor/pierre-diffs/worker.js", import.meta.url).href;
const THEMES = { dark: "xo-dark", light: "xo-light" };

/** ── languages: what the vendored build carries (tools/diffview/vendor.mjs LANGS) ───────────── @type {Record<string, string>} */
const EXT = {
  js: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript", mts: "typescript", cts: "typescript",
  jsx: "jsx", tsx: "tsx", json: "json", jsonc: "jsonc", json5: "jsonc", jsonl: "json",
  py: "python", pyi: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", kts: "kotlin", swift: "swift",
  c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp", cs: "csharp", rb: "ruby", php: "php",
  sh: "shellscript", bash: "shellscript", zsh: "shellscript", ps1: "powershell", sql: "sql",
  yaml: "yaml", yml: "yaml", toml: "toml", ini: "ini", cfg: "ini", properties: "ini",
  md: "markdown", markdown: "markdown", mdx: "markdown", css: "css", scss: "scss", html: "html", htm: "html",
  xml: "xml", svg: "xml", plist: "xml", vue: "vue", svelte: "svelte", graphql: "graphql", gql: "graphql",
  diff: "diff", patch: "diff", lua: "lua", r: "r", dart: "dart", scala: "scala", ex: "elixir", exs: "elixir",
  hs: "haskell", pl: "perl", pm: "perl", proto: "proto", tf: "terraform", tfvars: "terraform", tex: "latex",
};
/** @type {Record<string, string>} */
const NAME = {
  dockerfile: "docker", containerfile: "docker", makefile: "make", gnumakefile: "make", ".env": "dotenv",
  ".bashrc": "shellscript", ".zshrc": "shellscript", ".profile": "shellscript", "nginx.conf": "nginx",
};
/** The highlighting language for a path, or "text". @param {string | null | undefined} path */
function langOf(path) {
  const name = (String(path || "").split("/").pop() || "").toLowerCase();
  if (NAME[name]) return NAME[name];
  if (name.startsWith(".env.")) return "dotenv";
  if (name.startsWith("dockerfile.")) return "docker";
  const dot = name.lastIndexOf(".");
  return (dot > 0 || (dot === 0 && name.length > 1)) ? EXT[name.slice(dot + 1)] || "text" : "text";
}

/** @type {Promise<PierreDiffs> | null} */
let lib = null;
function load() {
  lib ??= Promise.all([
    /** @type {Promise<PierreDiffs>} */ (import(LIB)),
    import("./diffthemes.js"),
  ]).then(([P, T]) => {
    P.registerCustomTheme("xo-dark", async () => T.XO_DARK);
    P.registerCustomTheme("xo-light", async () => T.XO_LIGHT);
    return P;
  }).catch((e) => { lib = null; throw e; }); // a failed fetch can be tried again
  return lib;
}
/** @type {DiffWorkerPool | null} */
let pool = null;
/** @param {PierreDiffs} P */
function workers(P) {
  pool ??= P.getOrCreateWorkerPoolSingleton({
    poolOptions: { workerFactory: () => new Worker(WORKER, { type: "module" }), poolSize: 1, mainThreadMaxCharacters: 0 },
    highlighterOptions: { theme: THEMES, langs: [], preferredHighlighter: "shiki-js" },
  });
  return pool;
}

const loadedLangs = new Set();
const INPUT = ["wheel", "scroll", "pointerdown", "keydown", "touchstart"];
const quiet = () => new Promise(/** @param {(ready: boolean) => void} resolve */ (resolve) => {
  if (typeof addEventListener !== "function") { resolve(true); return; }
  const scope = createScope();
  let last = performance.now();
  const ready = () => { resolve(true); scope.dispose(); };
  scope.listen(globalThis, "pagehide", () => { resolve(false); scope.dispose(); });
  for (const event of INPUT) scope.listen(globalThis, event, () => { last = performance.now(); }, { capture: true, passive: true });
  function check() {
    const delay = 1200 - (performance.now() - last);
    if (delay > 0) { scope.timeout(check, delay); return; }
    if (typeof requestIdleCallback !== "function") { ready(); return; }
    scope.effect(() => {
      const idle = requestIdleCallback(ready, { timeout: 1000 });
      return () => cancelIdleCallback(idle);
    });
  }
  scope.timeout(check, 1200);
});
/** @param {string[]} [paths] */
export function prefetch(paths = []) {
  if (typeof Worker !== "function") return; // nowhere to colour (a test, an old browser): the first draw loads it
  const langs = [...new Set(paths.map(langOf))].filter((l) => l !== "text" && !loadedLangs.has(l));
  if (lib && !langs.length) return;
  for (const l of langs) loadedLangs.add(l);
  const retry = () => { for (const l of langs) loadedLangs.delete(l); };
  void quiet().then(async (ready) => {
    if (ready) await workers(await load()).initialize(langs);
    else retry();
  }).catch((error) => { retry(); reportFailure(error); });
}

/** @type {Set<RenderedDiff>} */
const live = new Set();
const themeNow = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
/** @param {string} t */
export function setTheme(t) { for (const v of live) v.setThemeType(t); }

/** @param {{ wrap?: boolean }} o */
const common = (o) => ({
  theme: THEMES, themeType: themeNow(), preferredHighlighter: "shiki-js",
  disableFileHeader: true, overflow: o.wrap ? "wrap" : "scroll", tokenizeMaxLineLength: 1000,
});

/** @param {PierreDiffs} P @param {string} patch @param {string | undefined} path @param {string | undefined} key */
function parse(P, patch, path, key) {
  const fd = P.parsePatchFiles(patch, key ? { cacheKeyPrefix: key } : undefined)[0]?.files[0];
  if (!fd) throw new Error("not a patch");
  fd.lang = langOf(path || fd.name);
  return fd;
}

/** A diff into host, from git's patch. @param {HTMLElement} host @param {string} patch @param {DiffOptions} [o]  */
export async function diff(host, patch, o = {}) {
  const P = await load();
  o.signal?.throwIfAborted();
  const v = new P.FileDiff({
    ...common(o), diffStyle: o.split ? "split" : "unified", diffIndicators: "bars", lineDiffType: "word",
    hunkSeparators: "line-info", expansionLineCount: 20,
    ...(o.loadFiles ? { loadDiffFiles: (fd) => o.loadFiles?.(fd) } : {}),
    ...(o.onSelect ? { enableLineSelection: true, onLineSelected: o.onSelect } : {}),
  }, workers(P));
  v.render({ fileDiff: parse(P, patch, o.path, o.key), containerWrapper: host });
  live.add(v);
  return {
    /** @param {string} next @param {string} [key] */
    update(next, key) { v.render({ fileDiff: parse(P, next, o.path, key), containerWrapper: host }); },
    /** @param {boolean} on */
    split(on) { v.setOptions({ ...v.options, diffStyle: on ? "split" : "unified" }); v.rerender(); },
    destroy() { live.delete(v); v.cleanUp(); host.replaceChildren(); },
  };
}

/** J / K: bring the next (dir 1) or previous (dir −1) change in a drawn diff to the top of its scroller, 40 px down. @param {HTMLElement} scroller @param {number} dir  */
export function jump(scroller, dir) {
  const root = scroller.querySelector("diffs-container")?.shadowRoot;
  if (!root) return false;
  const rows = /** @type {HTMLElement[]} */ ([...root.querySelectorAll("[data-line-type]")]);
  const changed = (/** @type {HTMLElement | undefined} */ r) => r && /addition|deletion/.test(r.dataset.lineType || "");
  const starts = rows.filter((r, i) => changed(r) && !changed(rows[i - 1]));
  const top = scroller.getBoundingClientRect().top + 40;
  const at = (/** @type {HTMLElement} */ r) => r.getBoundingClientRect().top - top;
  const to = dir > 0 ? starts.find((r) => at(r) > 2) : [...starts].reverse().find((r) => at(r) < -2);
  if (!to) return false;
  scroller.scrollTop += at(to);
  return true;
}
