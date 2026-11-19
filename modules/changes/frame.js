// @ts-check

// The panel's Changes: every file the place changed, one row each with its +/− counts, and the chosen file's diff below.

import { esc } from "../../core/platform/index.js";
import { xi } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { fileIcon } from "../../core/ui/icons/fileicons.js";
import * as DV from "./diffview.js";
import * as K from "../../core/platform/keys.js";
import { isImageChange, drawImageChange } from "./imagechange.js";
/** @import { Counts, FollowState, Drawn, FrameFile, FrameDeps, ChangeFile, Scope } from "./types.d.ts" */

const OPEN_IC = xi("external-link");
const base = (/** @type {string | null | undefined} */ p) => String(p || "").split("/").pop();
const SHOWN = 100; // rows drawn at first: a long list costs a frame per few hundred
const dirOf = (/** @type {string} */ p) => { const i = String(p || "").lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };

/** "+5 −8", tabular, green and red; nothing for a side with none. n: {additions, deletions} or {add, del}. @param {Counts | null | undefined} n */
export function countsHtml(n) {
  if (!n) return "";
  const a = n.additions ?? n.add, d = n.deletions ?? n.del;
  if (a == null && d == null) return "";
  if (!a && !d) return ""; // a pure rename, a mode change: its row says what happened
  return `<span class="xd-n" aria-label="${a || 0} added, ${d || 0} removed">${a ? `<b class="xd-a">+${a}</b>` : ""}${d ? `<b class="xd-d">−${d}</b>` : ""}</span>`;
}

/** The hunks of a patch, as text (for "which hunk is new"). */
const hunks = (/** @type {string | null | undefined} */ patch) => String(patch || "").split(/\n(?=@@ )/).slice(1);
/** The first line of the first hunk in next that wasn't in prev (the new file's numbering), or null. @param {string | null | undefined} prev @param {string | null | undefined} next */
export function newestHunkLine(prev, next) {
  const old = new Set(hunks(prev));
  for (const h of hunks(next)) {
    if (old.has(h)) continue;
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(h);
    if (!m) continue;
    // the first changed line: the hunk's start plus its leading context
    let n = +m[1];
    for (const l of h.split("\n").slice(1)) { if (l.startsWith(" ")) n++; else break; }
    return n;
  }
  return null;
}

/** Which file the frame shows, and whether an edit waits as the pill (pure; st is changed in place). @param {FollowState} st @param {(string | null)[]} paths @param {{ last: string | null, sig: string }} act */
export function choose(st, paths, act) {
  const has = (/** @type {string | null | undefined} */ p) => p != null && paths.includes(p);
  if (st.follow) st.sel = has(act.last) ? act.last : has(st.sel) ? st.sel : paths[0] ?? null;
  else if (!has(st.sel)) st.sel = paths[0] ?? null;
  if (st.follow) { st.pill = null; st.sig = act.sig; }
  else if (st.sig !== act.sig) { st.sig = act.sig; if (act.last) st.pill = act.last; }
  if (st.pill != null && !has(st.pill)) st.pill = null;
  return st;
}

/** Why there's no diff to draw, in words, from Space's patch_omitted (or a file without a patch). @param {ChangeFile} f */
function noPatchWords(f) {
  if (f.binary || f.patch_omitted === "binary") return "Binary file";
  if (f.patch_omitted === "submodule") return "A submodule";
  if (f.status === "renamed" && !f.additions && !f.deletions) return `Renamed from ${f.old_path || "elsewhere"}, nothing else changed`;
  if (f.status === "type_changed") return "Its type changed (a file, a link or a submodule)";
  return "Too large to show here";
}

/** @param {FrameDeps} deps */
export function createChangesFrame({ host, changes, view, openFile, onChange }) {
  host.innerHTML = `<div class="cx"><ul class="cx-list" role="listbox" aria-label="Changed files"></ul>` +
    `<section class="cx-pane" hidden><header class="cx-ph"></header><div class="cx-pd" tabindex="0" aria-label="The diff"></div><div class="cx-im" hidden></div><p class="cx-note" hidden></p>` +
    `<button type="button" class="cx-pill" data-cx-show hidden></button></section><p class="cx-none" hidden></p></div>`;
  const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (host.querySelector(s));
  const list = $(".cx-list"), pane = $(".cx-pane"), ph = $(".cx-ph"), pd = $(".cx-pd"), im = $(".cx-im"), note = $(".cx-note"), pill = $(".cx-pill"), none = $(".cx-none");

  /** @type {Map<string, FollowState>} */
  const ST = new Map();
  const stOf = (/** @type {string} */ key) => { if (!ST.has(key)) ST.set(key, { follow: true, sel: null, pill: null, sig: null }); return /** @type {FollowState} */ (ST.get(key)); };
  /** @type {Drawn} */
  const D = { key: null, path: null, patch: null, ver: null, handle: null, img: null, gen: 0, failed: false };
  /** What's drawn, shown: the diff, or an image's change, and no "Reading" note over it. */
  const showDrawn = (/** @type {ChangeFile | null} */ f = null) => {
    if (D.img) { im.hidden = false; pd.hidden = true; note.hidden = true; }
    else if (D.handle && D.patch) { pd.hidden = false; note.hidden = true; }
    else if (f && !D.failed) { pd.hidden = true; note.hidden = false; note.textContent = noPatchWords(f); } // binary, too large…
  };
  const dropImg = () => { if (D.img) { D.img.drop(); D.img = null; } im.hidden = true; im.replaceChildren(); };
  /** @type {Record<string, string>} */
  let H = { list: "", ph: "", pill: "", none: "" };

  // drawn in place (js/redraw.js): the row or button you're on stays itself as the list moves live
  const set = (/** @type {string} */ k, /** @type {HTMLElement} */ node, /** @type {string} */ html) => { if (H[k] !== html) { redraw(node, html); H[k] = html; } };
  /** The picked row marked, the one before unmarked: after a redraw of the list too (its rows come unmarked). @param {string | null} path */
  function markPick(path) {
    const was = /** @type {HTMLElement | null} */ (list.querySelector(".cx-r.is-on"));
    if (was && was.dataset.cx === path) return;
    if (was) { was.classList.remove("is-on"); was.setAttribute("aria-selected", "false"); }
    const now = path == null ? null : list.querySelector(`.cx-r[data-cx="${CSS.escape(path)}"]`);
    if (now) { now.classList.add("is-on"); now.setAttribute("aria-selected", "true"); }
  }

  /** One file's row, the same whichever file is picked: markPick marks the pick in place, so a new pick changes two rows, not the list. @param {FrameFile} f @param {Set<string>} live */
  function rowHtml(f, live) {
    const dir = dirOf(f.path), isLive = live.has(f.path);
    const sub = [dir, isLive ? "editing now" : f.status === "added" ? "new" : f.status === "deleted" ? "deleted" : f.status === "renamed" ? `from ${base(f.old_path)}` : ""].filter(Boolean).join(" · ");
    return `<li role="presentation"><button type="button" class="cx-r" role="option" aria-selected="false" data-cx="${esc(f.path)}" title="${esc(f.path)}">` +
      `<span class="cx-i">${fileIcon(f.path)}${isLive ? '<i class="arc"></i>' : ""}</span><span class="cx-t"><span class="cx-n">${esc(base(f.path))}</span>${sub ? `<span class="cx-d">${esc(sub)}</span>` : ""}</span>` +
      `${countsHtml(f)}</button></li>`;
  }

  /** Draw (or keep) the chosen file's diff. scrollTo: a line of the new file to bring into view. @param {string} key @param {FrameFile} f @param {string | null} patch @param {{ scrollTo?: number | null }} [o] */
  async function draw(key, f, patch, { scrollTo = null } = {}) {
    const ver = patch ? null : f.version ?? null;
    const same = D.key === key && D.path === f.path;
    if (same && D.patch === patch && D.ver === ver && !D.failed) { showDrawn(f); return; } // drawn: shown (it may have been hidden for another pick)
    // one draw per version: renders that come while it's on its way don't start it again
    if (D.pend && D.pend.key === key && D.pend.path === f.path && D.pend.patch === patch && D.pend.ver === ver) return;
    D.pend = { key, path: f.path, patch, ver };
    const my = ++D.gen;
    dropImg();
    if (!patch) {
      if (D.handle) { D.handle.destroy(); D.handle = null; }
      Object.assign(D, { key, path: f.path, patch: null, ver, failed: false });
      pd.hidden = true;
      const s = isImageChange(f) ? changes.scope(view()) : null;
      if (s && s.key === key) {
        note.hidden = true; im.hidden = false;
        const rel = s.worktree ? `.xo/worktrees/${s.worktree}/${f.path}` : f.path;
        const c = changes.of(view()), at = (c && "data" in c && c.data?.base_commit) || null;
        D.img = drawImageChange(im, { project: s.project, rel, file: f, read: changes.read, at, open: (from) => openFile(/** @type {Scope} */ (s), f.path, from) });
        return;
      }
      note.hidden = false;
      note.textContent = noPatchWords(f);
      return;
    }
    pd.hidden = false; note.hidden = true;
    try {
      if (same && D.handle) D.handle.update(patch);
      else {
        if (D.handle) { D.handle.destroy(); D.handle = null; }
        const h = await DV.diff(pd, patch, { path: f.path, wrap: true });
        if (my !== D.gen) { h.destroy(); return; }
        D.handle = h;
        pd.scrollTop = 0;
      }
      Object.assign(D, { key, path: f.path, patch, failed: false });
      if (scrollTo != null) reveal(scrollTo, my);
    } catch {
      if (my !== D.gen) return;
      D.pend = null;
      Object.assign(D, { key, path: f.path, patch: null, failed: true });
      pd.hidden = true; note.hidden = false;
      note.textContent = "Couldn't draw this diff. Pick the file again to retry.";
    }
  }
  /** Bring a line of the new file into view, once Pierre has drawn its rows (a frame or two). @param {number} line @param {number} my */
  async function reveal(line, my) {
    for (let i = 0; i < 30 && my === D.gen; i++) {
      const root = pd.querySelector("diffs-container")?.shadowRoot;
      const row = root && (root.querySelector(`[data-line="${line}"]:not([data-line-type="change-deletion"])`) || root.querySelector(`[data-line="${line}"]`));
      if (row) { pd.scrollTop += row.getBoundingClientRect().top - pd.getBoundingClientRect().top - 40; return; }
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    }
  }

  function paint() {
    const v = view();
    const s = changes.scope(v), c = changes.of(v);
    if (!s || !c || c.state === "unsupported") return false; // stage.js keeps today's list
    const st = stOf(s.key);
    const act = changes.activity(v);
    /** @type {FrameFile[]} */
    const files = [...c.files.values()];
    // a file being written that the last read hasn't brought yet still shows, on top (a project's own .xo/ is XO's, and Space never lists it there: nor does this)
    for (const p of act.live) if (!c.files.has(p) && (s.worktree || !p.startsWith(".xo/"))) files.unshift({ path: p, additions: null, deletions: null, status: "added", live: true });

    if (c.state === "loading" || c.state === "idle") {
      set("none", none, `<i class="spin" aria-hidden="true"></i> Reading what changed…`); none.hidden = false;
      list.hidden = true; pane.hidden = true; pill.hidden = true;
      return true;
    }
    if (c.state === "error" && !files.length) {
      set("none", none, esc(("err" in c && c.err) || "Couldn't read what changed.")); none.hidden = false;
      list.hidden = true; pane.hidden = true; pill.hidden = true;
      return true;
    }
    if (!files.length) {
      set("none", none, "Nothing changed here yet."); none.hidden = false;
      list.hidden = true; pane.hidden = true; pill.hidden = true;
      if (D.handle || D.img) { if (D.handle) D.handle.destroy(); dropImg(); Object.assign(D, { handle: null, path: null, patch: null, ver: null, pend: null }); }
      return true;
    }
    none.hidden = true; list.hidden = false;

    const prevSel = st.sel;
    choose(st, files.map((f) => f.path), act);

    // a long list draws its first SHOWN rows (and the chosen one); the rest on asking.
    const rows = st.all || files.length <= SHOWN ? files : files.filter((f, i) => i < SHOWN || f.path === st.sel);
    const all = "data" in c && c.data && c.data.total_files > files.length ? c.data.total_files : files.length;
    const more = all - rows.length;
    set("list", list, rows.map((f) => rowHtml(f, act.live)).join("") +
      (more > 0 ? `<li role="presentation"><button type="button" class="cx-more"${rows.length < files.length ? " data-cx-all" : " disabled"}>${rows.length < files.length ? `${(files.length - rows.length).toLocaleString()} more files · Show them` : `${more.toLocaleString()} more files, too many to list here`}</button></li>` : ""));
    markPick(st.sel);
    // "Show them" pressed: focus moves on to the first row it revealed, only where it would otherwise be lost.
    if (st.reveal) {
      const was = st.reveal, a = document.activeElement; st.reveal = null;
      const first = /** @type {HTMLElement[]} */ ([...list.querySelectorAll("[data-cx]")]).find((r) => !was.has(r.dataset.cx));
      if (first && (!a || a === document.body || !a.isConnected || list.contains(a))) first.focus({ preventScroll: true });
    }
    const f = /** @type {FrameFile} */ (files.find((x) => x.path === st.sel));
    set("ph", ph, `<span class="cx-pp" title="${esc(f.path)}">${esc(f.path)}</span>${countsHtml(f)}<span class="cx-sp"></span><button type="button" class="cx-ofi" data-cx-open title="Open in Files: the whole file, side by side" aria-label="Open in Files">${OPEN_IC}</button>`);
    pane.hidden = false;
    set("pill", pill, st.pill ? `<i aria-hidden="true"></i><span><b>${esc(base(st.pill))}</b> ${st.pill === st.sel ? "updated" : "changed"}</span><span class="cx-show">Show</span>` : "");
    pill.hidden = !st.pill;
    pill.dataset.cxShow = st.pill || "";

    // the diff: following redraws on every agent edit (at its newest hunk); paused, only your own pick does
    const live = f.live ? null : f;
    if (!live) { draw(s.key, { ...f, binary: false, patch_omitted: null }, null); note.textContent = "Being written now…"; return true; }
    const shown = D.key === s.key && D.path === f.path;
    // never redraw under you; but what's drawn is shown again if picking another file hid it (A, then B while it was read, then A again)
    if (shown && !st.follow && D.patch && prevSel === st.sel) { showDrawn(f); return true; }
    // another file picked: the last diff goes at once and it says it's reading, except while this file's own draw is on its way.
    const coming = D.pend && D.pend.key === s.key && D.pend.path === f.path;
    if (!shown && !coming) { pd.hidden = true; im.hidden = true; note.hidden = false; note.textContent = "Reading its change…"; }
    changes.patch(v, f.path).then((/** @type {string | null} */ patch) => {
      if (stOf(s.key).sel !== f.path || changes.scope(view())?.key !== s.key) return;
      const line = shown && st.follow && D.patch && patch !== D.patch ? newestHunkLine(D.patch, patch) : null;
      draw(s.key, f, patch, { scrollTo: line });
    }).catch(() => {
      // a failure for a file that isn't the pick any more says nothing (a late B failing hid a newer C)
      if (stOf(s.key).sel !== f.path || changes.scope(view())?.key !== s.key) return;
      note.hidden = false; pd.hidden = true; im.hidden = true; note.textContent = "Couldn't read this file's change.";
    });
    return true;
  }

  function pause() {
    const s = changes.scope(view());
    if (!s) return;
    const st = stOf(s.key);
    if (!st.follow) return;
    st.follow = false; st.sig = changes.activity(view()).sig;
    onChange && onChange();
  }

  // ── you, in the panel ────────────────────────────────────────────────────────
  host.addEventListener("click", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (t.closest("[data-cx-all]")) {
      const s = changes.scope(view());
      if (s) { const st = stOf(s.key); st.all = true; st.reveal = new Set(/** @type {HTMLElement[]} */ ([...list.querySelectorAll("[data-cx]")]).map((r) => r.dataset.cx)); onChange && onChange(); }
      return;
    }
    const r = /** @type {HTMLElement | null} */ (t.closest("[data-cx]"));
    if (r) { const s = changes.scope(view()); if (!s) return; const st = stOf(s.key); st.follow = false; st.sig = changes.activity(view()).sig; st.sel = r.dataset.cx ?? null; if (st.pill === st.sel) st.pill = null; onChange && onChange(); return; }
    if (t.closest("[data-cx-show]")) {
      const s = changes.scope(view()); if (!s) return; const st = stOf(s.key); st.sel = pill.dataset.cxShow || st.sel; st.pill = null; D.patch = null; D.pend = null;
      // the pill goes once answered: focus goes first to the file it showed, in the list.
      (/** @type {HTMLElement | null} */ (list.querySelector(`[data-cx="${CSS.escape(st.sel || "")}"]`)) || pd).focus({ preventScroll: true });
      onChange && onChange(); return;
    }
    // the file picked (whose header holds this button), not the last diff drawn
    if (t.closest("[data-cx-open]")) { const s = changes.scope(view()); const p = s && (stOf(s.key).sel || D.path); if (s && p) openFile(s, p, /** @type {HTMLElement | null} */ (t.closest("[data-cx-open]"))); }
  });
  // touching the diff (a scroll, a press, a key) is reading it: following pauses there
  for (const ev of ["wheel", "pointerdown", "keydown"]) pd.addEventListener(ev, pause, { passive: true });
  // J / K: the next or previous change in the diff (reading it: following pauses)
  host.addEventListener("keydown", (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest("input, textarea, [contenteditable]") || pd.hidden) return;
    const dir = K.is(e, "nextChange") ? 1 : K.is(e, "prevChange") ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    pause();
    DV.jump(pd, dir);
  });
  list.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = /** @type {HTMLElement[]} */ ([...list.querySelectorAll(".cx-r")]), i = rows.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (i < 0) return;
    e.preventDefault();
    const n = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    n.focus(); n.click();
  });

  return {
    /** Every render while the panel is open; false when the place has no /changes (stage.js keeps the old list). */
    paint,
    /** The frame head's words: {count, total, follow, busy}, or null when unsupported. */
    head() {
      const v = view(), s = changes.scope(v), c = changes.of(v);
      if (!s || !c || c.state === "unsupported") return null;
      return { count: Math.max(c.files.size, ("data" in c && c.data && c.data.total_files) || 0), total: c.total, follow: stOf(s.key).follow, busy: changes.activity(v).busy };
    },
    /** A chip's click: this file, chosen by you (following pauses). @param {string} path */
    select(path) { const s = changes.scope(view()); if (!s) return false; const st = stOf(s.key); st.follow = false; st.sig = changes.activity(view()).sig; st.sel = path; st.pill = null; return true; },
    /** You handed the work back (a message sent), or pressed Follow: follow the agent again. */
    resume(v = view()) { const s = changes.scope(v); if (!s) return; const st = stOf(s.key); st.follow = true; st.pill = null; },
    toggleFollow() { const s = changes.scope(view()); if (!s) return; const st = stOf(s.key); if (st.follow) { st.follow = false; st.sig = changes.activity(view()).sig; } else { st.follow = true; st.pill = null; } },
    /** The file chosen in a view (its chip reads as chosen), or null. */
    chosen(v = view()) { const s = changes.scope(v); return s && ST.has(s.key) ? stOf(s.key).sel : null; },
    /** Is a diff showing (the panel then asks for more width)? */
    get wide() { return !pane.hidden && !!D.handle; },
  };
}
