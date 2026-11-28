// @ts-check

// Go to a file (⌘P) or find text in the place's files (⌘⇧F), in the sheet ⌘K uses (#qo).

import { esc, rank, marked, lineOf } from "../../core/platform/index.js";
import { xi } from "../../core/ui/icons/icon.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import { missingRoute } from "../../core/platform/http.js";

const SEARCH_MS = 220;
const MAX_FILES = 60;

/** @param {import("./types").SearchScope} scope @param {import("./types").QuickOpenDeps} deps */
export function createQuickOpen(scope, { paths, api, place, openFile, openFiles = () => [], announce = () => {}, layer = {} }) {
  const el = document.createElement("div");
  el.className = "sheet";
  el.id = "qo";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = `<div class="sheet-card jump-card qo-card"><div class="jump-field"><span class="qo-ic" aria-hidden="true"></span>` +
    `<input id="qo-q" autocomplete="off" spellcheck="false" aria-controls="qo-list" aria-autocomplete="list"><span class="qo-where"></span></div>` +
    `<div class="qo-opts" hidden><button type="button" class="qo-opt" data-qo-opt="case" aria-pressed="false" title="Match case">Aa</button><button type="button" class="qo-opt" data-qo-opt="word" aria-pressed="false" title="Whole word">ab</button><button type="button" class="qo-opt" data-qo-opt="regex" aria-pressed="false" title="Regular expression">.*</button></div>` +
    `<ul class="jump-list qo-list" id="qo-list" role="listbox"></ul><p class="qo-foot" role="status"></p></div>`;
  document.body.appendChild(el);
  const q = /** @type {HTMLInputElement} */ (el.querySelector("#qo-q"));
  const list = /** @type {HTMLElement} */ (el.querySelector("#qo-list"));
  const foot = /** @type {HTMLElement} */ (el.querySelector(".qo-foot"));
  const opts = /** @type {HTMLElement} */ (el.querySelector(".qo-opts"));
  const ic = /** @type {HTMLElement} */ (el.querySelector(".qo-ic"));
  const where = /** @type {HTMLElement} */ (el.querySelector(".qo-where"));
  /** @type {import("./types").QuickOpenState} */
  const S = { mode: "files", pl: /** @type {import("./types").Place} */ (/** @type {unknown} */ (null)), items: [], sel: 0, back: null, gen: 0, t: null, o: { case: false, word: false, regex: false }, noSearch: false };

  function open(mode = "files") {
    const pl = place();
    if (scope.signal.aborted || !pl || !pl.project) return false;
    S.pl = pl; S.mode = mode; S.sel = 0; S.items = []; S.pendingEnter = false;
    S.back = document.activeElement;
    el.hidden = false;
    el.setAttribute("aria-label", mode === "files" ? "Go to a file" : "Find in files");
    q.placeholder = mode === "files" ? "Go to a file (type :120 for a line)" : "Find in files";
    ic.innerHTML = mode === "files" ? xi("doc") : xi("search");
    where.textContent = pl.label || "";
    opts.hidden = mode !== "text";
    q.value = "";
    if (mode === "files") paths.of(pl);
    draw();
    layer.shown && layer.shown(el);
    q.focus({ preventScroll: true });
    return true;
  }
  function close({ restore = true } = {}) {
    if (el.hidden) return;
    el.hidden = true; S.gen++; S.t?.(); S.t = null;
    layer.hidden && layer.hidden(el);
    if (restore && S.back && S.back.isConnected) /** @type {HTMLElement} */ (S.back).focus({ preventScroll: true });
  }

  function draw() {
    if (S.mode === "files") drawFiles(); else drawText();
  }
  function drawFiles() {
    const { query, line } = lineOf(q.value);
    const e = paths.of(S.pl);
    const open = /** @type {string[]} */ (openFiles().map((f) => f.rel).filter(Boolean));
    const all = e.paths || [];
    const base = S.pl.base ? `${S.pl.base}/` : "";
    const openLocal = open.filter((r) => r.startsWith(base)).map((r) => r.slice(base.length));
    const pool = query.trim() ? all : [...openLocal, ...all.filter((p) => !openLocal.includes(p))];
    const ranked = /** @type {{ path: string, hits: number[] }[]} */ (rank(pool, query, MAX_FILES));
    const files = ranked.map((m) => ({ kind: /** @type {const} */ ("file"), path: m.path, hits: m.hits, line }));
    S.items = files;
    if (S.sel >= S.items.length) S.sel = 0;
    list.innerHTML = files.map((x, i) => {
      const name = /** @type {string} */ (x.path.split("/").pop()), dir = x.path.slice(0, x.path.length - name.length).replace(/\/$/, "");
      const nameHits = x.hits.filter((/** @type {number} */ h) => h >= x.path.length - name.length).map((/** @type {number} */ h) => h - (x.path.length - name.length));
      const dirHits = x.hits.filter((/** @type {number} */ h) => h < dir.length);
      return `<li id="qo-${i}" role="option" data-i="${i}" aria-selected="${i === S.sel}"><span class="qo-fi" aria-hidden="true">${fileIcon(name)}</span><span class="qo-n">${marked(name, nameHits, esc)}</span><span class="qo-d">${marked(dir, dirHits, esc)}</span>${openLocal.includes(x.path) && !query.trim() ? `<span class="qo-tag">open</span>` : ""}</li>`;
    }).join("");
    q.setAttribute("aria-activedescendant", S.items.length ? `qo-${S.sel}` : "");
    foot.textContent = e.state === "loading" ? `Reading the files… ${all.length ? `${all.length} so far` : ""}` : e.state === "error" ? "Couldn't read the files here." : !S.items.length && query.trim() ? "No file matches." : e.truncated ? `The first ${all.length} files.` : line ? `Line ${line}` : "";
  }

  function drawText() {
    if (S.noSearch) {
      list.innerHTML = "";
      foot.textContent = "Finding text in files needs the newer XO Space (its /search). Go to a file with ⌘P meanwhile.";
      return;
    }
    list.innerHTML = S.items.map((x, i) => x.kind === "head"
      ? `<li class="qo-h" role="presentation"><span class="qo-fi" aria-hidden="true">${fileIcon(x.path)}</span><span class="qo-n">${esc(x.path.split("/").pop())}</span><span class="qo-d">${esc(x.path)}</span><span class="qo-tag">${x.n}</span></li>`
      : x.kind !== "match" ? "" : `<li id="qo-${i}" role="option" data-i="${i}" aria-selected="${i === S.sel}" class="qo-m"><span class="qo-ln">${x.line}</span><span class="qo-t">${hl(x.text, x.ranges)}</span></li>`).join("");
    q.setAttribute("aria-activedescendant", S.items[S.sel] && S.items[S.sel].kind === "match" ? `qo-${S.sel}` : "");
  }
  /** @param {string} text @param {[number, number][] | undefined} ranges */
  const hl = (text, ranges) => {
    if (!ranges || !ranges.length) return esc(text);
    let out = "", at = 0;
    for (const [a, b] of ranges) { out += esc(text.slice(at, a)) + `<b>${esc(text.slice(a, b))}</b>`; at = b; }
    return out + esc(text.slice(at));
  };
  async function search() {
    const text = q.value.replace(/[\r\n]+/g, " ");
    const my = ++S.gen;
    if (!text.trim()) { S.items = []; foot.textContent = ""; drawText(); return; }
    foot.textContent = "Finding…";
    try {
      const worktree = S.pl.base ? S.pl.base.split("/").pop() : null;
      const r = await api.projectSearch(S.pl.project, { q: text, worktree, ...S.o, signal: scope.signal });
      if (my !== S.gen) return;
      /** @type {Map<string, import("./types").Match[]>} */
      const by = new Map();
      for (const m of r.matches || []) { if (!by.has(m.path)) by.set(m.path, []); /** @type {import("./types").Match[]} */ (by.get(m.path)).push(m); }
      S.items = [];
      for (const [path, ms] of by) {
        S.items.push({ kind: "head", path, n: ms.length });
        for (const m of ms) S.items.push({ kind: "match", path, line: m.line, col: m.col, text: m.text, ranges: m.ranges });
      }
      S.sel = S.items.findIndex((x) => x.kind === "match");
      const n = (r.matches || []).length;
      foot.textContent = n ? `${n} ${n === 1 ? "match" : "matches"} in ${r.files ?? by.size} ${by.size === 1 ? "file" : "files"}${r.truncated ? " (the first ones)" : ""}` : "Nothing found.";
      announce(foot.textContent);
    } catch (cause) {
      const err = /** @type {{ code?: string, message?: string } | null} */ (cause);
      if (my !== S.gen) return;
      if (missingRoute(err)) { S.noSearch = true; S.items = []; }
      else foot.textContent = err && err.code === "bad_regex" ? `Not a valid pattern: ${err.message || ""}` : (err && err.message) || "Couldn't search.";
    }
    drawText();
  }

  /** @param {number} i */
  function pick(i) {
    const x = S.items[i];
    if (!x || x.kind === "head") return;
    close({ restore: false });
    const base = S.pl.base ? `${S.pl.base}/` : "";
    openFile(base + x.path, { line: x.line || null, col: /** @type {{ col?: number }} */ (x).col || null });
  }
  /** @param {number} d */
  function move(d) {
    const n = S.items.length;
    if (!n) return;
    let i = S.sel;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (S.items[i].kind !== "head") break; }
    S.sel = i;
    for (const li of /** @type {NodeListOf<HTMLElement>} */ (list.querySelectorAll("[aria-selected]"))) li.setAttribute("aria-selected", String(+(li.dataset.i ?? "") === i));
    q.setAttribute("aria-activedescendant", `qo-${i}`);
    list.querySelector(`#qo-${i}`)?.scrollIntoView({ block: "nearest" });
  }
  /** @param {Event} e */
  const row = (e) => /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest("[data-i]"));

  scope.effect(() => () => {
    S.gen++;
    S.t?.(); S.t = null;
    el.remove();
  });

  scope.listen(q, "input", () => {
    S.sel = 0; S.pendingEnter = false;
    if (S.mode === "files") drawFiles();
    else {
      S.t?.();
      S.t = scope.timeout(() => { S.t = null; void search(); }, SEARCH_MS);
    }
  });
  scope.listen(q, "keydown", (event) => {
    const e = /** @type {KeyboardEvent} */ (event);
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (S.mode === "text" && S.t && !S.items.length) { S.t?.(); S.t = null; search(); return; }
      if (S.mode === "files" && !S.items.length && paths.of(S.pl).state === "loading") { S.pendingEnter = true; foot.textContent = "Opening the first match once the files are read…"; return; }
      pick(S.sel);
    }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });
  scope.listen(list, "click", (e) => { const li = row(e); if (li) pick(+(li.dataset.i ?? "")); });
  scope.listen(list, "pointermove", (e) => { const li = row(e); if (li && +(li.dataset.i ?? "") !== S.sel && S.items[+(li.dataset.i ?? "")]?.kind !== "head") { S.sel = +(li.dataset.i ?? ""); for (const x of list.querySelectorAll("[aria-selected]")) x.setAttribute("aria-selected", String(x === li)); } });
  scope.listen(opts, "click", (e) => { const b = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest("[data-qo-opt]")); if (!b) return; const k = /** @type {string} */ (b.dataset.qoOpt); S.o[k] = !S.o[k]; b.setAttribute("aria-pressed", String(S.o[k])); q.focus(); search(); });
  scope.listen(el, "mousedown", (e) => { if (e.target === el) close(); });

  return {
    open, close,
    get isOpen() { return !el.hidden; },
    el,
    refresh() {
      if (el.hidden || S.mode !== "files") return;
      drawFiles();
      if (S.pendingEnter && S.items.length) { S.pendingEnter = false; pick(0); }
      else if (S.pendingEnter && paths.of(S.pl).state !== "loading") { S.pendingEnter = false; }
    },
  };
}
