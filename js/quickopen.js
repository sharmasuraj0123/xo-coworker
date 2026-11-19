// Go to a file (⌘P) or find text in the place's files (⌘⇧F), as VS Code's Quick Open and Search do, in the sheet ⌘K
// uses (#qo, the same card). Files: a few letters of a path (js/fuzzy.js over js/paths.js: every file in the place,
// open ones first), and `:120` to land on a line. Text: Space's GET /search (git grep, SPACE-CONTRACT.md §4.7),
// results by file, a line each; Enter opens the file at that line. Where Space has no /search yet, it says so.
//
// createQuickOpen({paths, api, place, openFile, openFiles, announce, layer}) → {open(mode), close, isOpen}.
//   place() → {project, base, label} for the view (null: nothing to search); openFile(rel, {line, col}) opens a file
//   of the place; openFiles() → the files open now ({rel}); layer.shown()/hidden() keeps the page behind inert.

import { esc } from "./util.js";
import { fileIcon } from "./fileicons.js";
import { rank, marked, lineOf } from "./fuzzy.js";
import { missingRoute } from "./api.js";

const SEARCH_MS = 220;
const MAX_FILES = 60;

export function createQuickOpen({ paths, api, place, openFile, openFiles = () => [], announce = () => {}, layer = {} }) {
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
  const q = el.querySelector("#qo-q"), list = el.querySelector("#qo-list"), foot = el.querySelector(".qo-foot"), opts = el.querySelector(".qo-opts");
  const S = { mode: "files", pl: null, items: [], sel: 0, back: null, gen: 0, t: 0, o: { case: false, word: false, regex: false }, noSearch: false };

  function open(mode = "files") {
    const pl = place();
    if (!pl || !pl.project) return false;
    S.pl = pl; S.mode = mode; S.sel = 0; S.items = []; S.pendingEnter = false;
    S.back = document.activeElement;
    el.hidden = false;
    el.setAttribute("aria-label", mode === "files" ? "Go to a file" : "Find in files");
    q.placeholder = mode === "files" ? "Go to a file (type :120 for a line)" : "Find in files";
    el.querySelector(".qo-ic").innerHTML = mode === "files" ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z"/></svg>` : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>`;
    el.querySelector(".qo-where").textContent = pl.label || "";
    opts.hidden = mode !== "text";
    q.value = "";
    if (mode === "files") paths.of(pl); // starts reading the place's list if it hasn't
    draw();
    layer.shown && layer.shown(el);
    q.focus({ preventScroll: true });
    return true;
  }
  function close({ restore = true } = {}) {
    if (el.hidden) return;
    el.hidden = true; S.gen++; clearTimeout(S.t);
    layer.hidden && layer.hidden(el);
    if (restore && S.back && S.back.isConnected) S.back.focus({ preventScroll: true });
  }

  function draw() {
    if (S.mode === "files") drawFiles(); else drawText();
  }
  function drawFiles() {
    const { query, line } = lineOf(q.value);
    const e = paths.of(S.pl);
    const open = openFiles().map((f) => f.rel).filter(Boolean);
    const all = e.paths || [];
    const base = S.pl.base ? `${S.pl.base}/` : "";
    const openLocal = open.filter((r) => r.startsWith(base)).map((r) => r.slice(base.length));
    const pool = query.trim() ? all : [...openLocal, ...all.filter((p) => !openLocal.includes(p))];
    S.items = rank(pool, query, MAX_FILES).map((m) => ({ kind: "file", path: m.path, hits: m.hits, line }));
    if (S.sel >= S.items.length) S.sel = 0;
    list.innerHTML = S.items.map((x, i) => {
      const name = x.path.split("/").pop(), dir = x.path.slice(0, x.path.length - name.length).replace(/\/$/, "");
      const nameHits = x.hits.filter((h) => h >= x.path.length - name.length).map((h) => h - (x.path.length - name.length));
      const dirHits = x.hits.filter((h) => h < dir.length);
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
      : `<li id="qo-${i}" role="option" data-i="${i}" aria-selected="${i === S.sel}" class="qo-m"><span class="qo-ln">${x.line}</span><span class="qo-t">${hl(x.text, x.ranges)}</span></li>`).join("");
    q.setAttribute("aria-activedescendant", S.items[S.sel] && S.items[S.sel].kind === "match" ? `qo-${S.sel}` : "");
  }
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
      const r = await api.projectSearch(S.pl.project, { q: text, worktree, ...S.o });
      if (my !== S.gen) return;
      const by = new Map();
      for (const m of r.matches || []) { if (!by.has(m.path)) by.set(m.path, []); by.get(m.path).push(m); }
      S.items = [];
      for (const [path, ms] of by) {
        S.items.push({ kind: "head", path, n: ms.length });
        for (const m of ms) S.items.push({ kind: "match", path, line: m.line, col: m.col, text: m.text, ranges: m.ranges });
      }
      S.sel = S.items.findIndex((x) => x.kind === "match");
      const n = (r.matches || []).length;
      foot.textContent = n ? `${n} ${n === 1 ? "match" : "matches"} in ${r.files ?? by.size} ${by.size === 1 ? "file" : "files"}${r.truncated ? " (the first ones)" : ""}` : "Nothing found.";
      announce(foot.textContent);
    } catch (err) {
      if (my !== S.gen) return;
      if (missingRoute(err)) { S.noSearch = true; S.items = []; }
      else foot.textContent = err && err.code === "bad_regex" ? `Not a valid pattern: ${err.message || ""}` : (err && err.message) || "Couldn't search.";
    }
    drawText();
  }

  function pick(i) {
    const x = S.items[i];
    if (!x || x.kind === "head") return;
    close({ restore: false });
    const base = S.pl.base ? `${S.pl.base}/` : "";
    openFile(base + x.path, { line: x.line || null, col: x.col || null });
  }
  function move(d) {
    const n = S.items.length;
    if (!n) return;
    let i = S.sel;
    for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (S.items[i].kind !== "head") break; }
    S.sel = i;
    for (const li of list.querySelectorAll("[aria-selected]")) li.setAttribute("aria-selected", String(+li.dataset.i === i));
    q.setAttribute("aria-activedescendant", `qo-${i}`);
    list.querySelector(`#qo-${i}`)?.scrollIntoView({ block: "nearest" });
  }

  q.addEventListener("input", () => {
    S.sel = 0; S.pendingEnter = false;
    if (S.mode === "files") drawFiles();
    else { clearTimeout(S.t); S.t = setTimeout(search, SEARCH_MS); }
  });
  q.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); move(e.key === "ArrowDown" ? 1 : -1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (S.mode === "text" && S.t && !S.items.length) { clearTimeout(S.t); search(); return; }
      // the place's files still being read: Enter waits for the first match rather than doing nothing
      if (S.mode === "files" && !S.items.length && paths.of(S.pl).state === "loading") { S.pendingEnter = true; foot.textContent = "Opening the first match once the files are read…"; return; }
      pick(S.sel);
    }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  });
  list.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) pick(+li.dataset.i); });
  list.addEventListener("pointermove", (e) => { const li = e.target.closest("[data-i]"); if (li && +li.dataset.i !== S.sel && S.items[+li.dataset.i]?.kind !== "head") { S.sel = +li.dataset.i; for (const x of list.querySelectorAll("[aria-selected]")) x.setAttribute("aria-selected", String(x === li)); } });
  opts.addEventListener("click", (e) => { const b = e.target.closest("[data-qo-opt]"); if (!b) return; const k = b.dataset.qoOpt; S.o[k] = !S.o[k]; b.setAttribute("aria-pressed", String(S.o[k])); q.focus(); search(); });
  el.addEventListener("mousedown", (e) => { if (e.target === el) close(); });

  return {
    open, close,
    get isOpen() { return !el.hidden; },
    el,
    /** The place's list changed (it grew while being read, a file came or went): redraw if open. */
    refresh() {
      if (el.hidden || S.mode !== "files") return;
      drawFiles();
      if (S.pendingEnter && S.items.length) { S.pendingEnter = false; pick(0); }
      else if (S.pendingEnter && paths.of(S.pl).state !== "loading") { S.pendingEnter = false; }
    },
  };
}
