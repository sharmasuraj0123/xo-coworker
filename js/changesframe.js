// The panel's Changes (design-research/2026-11-vision/pierre, "Diffs live in the right panel"): every file the
// place changed, one 32 px row each with its +/− counts, then the chosen file's diff below the list, drawn
// from git's patch by js/diffview.js. The chat says what changed; this holds how.
//
// Following (on by default, the owner's D6): while you leave the panel alone it shows the file the agent
// changed last, at the hunk it just changed, once per finished edit. The moment you touch it (pick a file,
// scroll or click in the diff, a key in it) it stays where you are; an edit after that shows a quiet pill,
// "app.js changed · Show", and never moves anything. Sending the agent a message, or Follow, resumes it.
//
// An image Space sends without a patch (git has no line diff for a picture) shows as itself in the pane
// (js/imagechange.js); a click on it opens it in Files.
//
// stage.js mounts it in the Changes frame and calls: paint (every render), head, select, resume, chosen,
// wide. It reads js/changes.js; "Open in Files" goes through openFile.

import { esc } from "./util.js";
import { fileIcon } from "./fileicons.js";
import * as DV from "./diffview.js";
import * as K from "./keys.js";
import { isImageChange, drawImageChange } from "./imagechange.js";

const OPEN_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-8 8M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></svg>';
const base = (p) => String(p || "").split("/").pop();
const SHOWN = 100; // rows drawn at first: a long list costs a frame per few hundred
const dirOf = (p) => { const i = String(p || "").lastIndexOf("/"); return i < 0 ? "" : p.slice(0, i); };

/** "+5 −8", tabular, green and red; nothing for a side with none. n: {additions, deletions} or {add, del}. */
export function countsHtml(n) {
  if (!n) return "";
  const a = n.additions ?? n.add, d = n.deletions ?? n.del;
  if (a == null && d == null) return "";
  if (!a && !d) return ""; // a pure rename, a mode change: its row says what happened
  return `<span class="xd-n" aria-label="${a || 0} added, ${d || 0} removed">${a ? `<b class="xd-a">+${a}</b>` : ""}${d ? `<b class="xd-d">−${d}</b>` : ""}</span>`;
}

/** The hunks of a patch, as text (for "which hunk is new"). */
const hunks = (patch) => String(patch || "").split(/\n(?=@@ )/).slice(1);
/** The first line of the first hunk in next that wasn't in prev (the new file's numbering), or null. */
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

/**
 * Which file the frame shows, and whether an edit waits as the pill (pure; st is changed in place).
 * Following: the file the agent changed last, else the one shown, else the first. Paused (you touched the
 * panel): yours, while it's still changed; an agent's edit after that waits as the pill, never a jump.
 * st: {follow, sel, pill, sig}; paths: the files changed, in order; act: {sig, last} (js/changes.js).
 */
export function choose(st, paths, act) {
  const has = (p) => p != null && paths.includes(p);
  if (st.follow) st.sel = has(act.last) ? act.last : has(st.sel) ? st.sel : paths[0] ?? null;
  else if (!has(st.sel)) st.sel = paths[0] ?? null;
  if (st.follow) { st.pill = null; st.sig = act.sig; }
  else if (st.sig !== act.sig) { st.sig = act.sig; if (act.last) st.pill = act.last; }
  if (st.pill != null && !has(st.pill)) st.pill = null;
  return st;
}

/** Why there's no diff to draw, in words, from Space's patch_omitted (or a file without a patch). */
function noPatchWords(f) {
  if (f.binary || f.patch_omitted === "binary") return "Binary file";
  if (f.patch_omitted === "submodule") return "A submodule";
  if (f.status === "renamed" && !f.additions && !f.deletions) return `Renamed from ${f.old_path || "elsewhere"}, nothing else changed`;
  if (f.status === "type_changed") return "Its type changed (a file, a link or a submodule)";
  return "Too large to show here";
}

export function createChangesFrame({ host, changes, view, openFile, onChange }) {
  host.innerHTML = `<div class="cx"><ul class="cx-list" role="listbox" aria-label="Changed files"></ul>` +
    `<section class="cx-pane" hidden><header class="cx-ph"></header><div class="cx-pd" tabindex="0" aria-label="The diff"></div><div class="cx-im" hidden></div><p class="cx-note" hidden></p>` +
    `<button type="button" class="cx-pill" data-cx-show hidden></button></section><p class="cx-none" hidden></p></div>`;
  const $ = (s) => host.querySelector(s);
  const list = $(".cx-list"), pane = $(".cx-pane"), ph = $(".cx-ph"), pd = $(".cx-pd"), im = $(".cx-im"), note = $(".cx-note"), pill = $(".cx-pill"), none = $(".cx-none");

  const ST = new Map(); // scope key → {follow, sel, pill, paused sig}
  const stOf = (key) => { if (!ST.has(key)) ST.set(key, { follow: true, sel: null, pill: null, sig: null }); return ST.get(key); };
  // what's drawn: {key, path, patch, ver (an image's version: a new one is read again), handle, img (an image
  // change's drawing)}
  const D = { key: null, path: null, patch: null, ver: null, handle: null, img: null, gen: 0, failed: false };
  const dropImg = () => { if (D.img) { D.img.drop(); D.img = null; } im.hidden = true; im.replaceChildren(); };
  let H = { list: "", ph: "", pill: "", none: "" };

  const set = (k, node, html) => { if (H[k] !== html) { node.innerHTML = html; H[k] = html; } };

  function rowHtml(f, sel, live) {
    const on = f.path === sel, dir = dirOf(f.path), isLive = live.has(f.path);
    const sub = [dir, isLive ? "editing now" : f.status === "added" ? "new" : f.status === "deleted" ? "deleted" : f.status === "renamed" ? `from ${base(f.old_path)}` : ""].filter(Boolean).join(" · ");
    return `<li role="presentation"><button type="button" class="cx-r${on ? " is-on" : ""}" role="option" aria-selected="${on}" data-cx="${esc(f.path)}" title="${esc(f.path)}">` +
      `<span class="cx-i">${fileIcon(f.path)}${isLive ? '<i class="arc"></i>' : ""}</span><span class="cx-t"><span class="cx-n">${esc(base(f.path))}</span>${sub ? `<span class="cx-d">${esc(sub)}</span>` : ""}</span>` +
      `${countsHtml(f)}</button></li>`;
  }

  /** Draw (or keep) the chosen file's diff. scrollTo: a line of the new file to bring into view. */
  async function draw(key, f, patch, { scrollTo = null } = {}) {
    const ver = patch ? null : f.version ?? null;
    const same = D.key === key && D.path === f.path;
    if (same && D.patch === patch && D.ver === ver && !D.failed) return;
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
        const at = changes.of(view())?.data?.base_commit || null;
        D.img = drawImageChange(im, { project: s.project, rel, file: f, at, open: (from) => openFile(s, f.path, from) });
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
  /** Bring a line of the new file into view, once Pierre has drawn its rows (a frame or two). */
  async function reveal(line, my) {
    for (let i = 0; i < 30 && my === D.gen; i++) {
      const root = pd.querySelector("diffs-container")?.shadowRoot;
      const row = root && (root.querySelector(`[data-line="${line}"]:not([data-line-type="change-deletion"])`) || root.querySelector(`[data-line="${line}"]`));
      if (row) { pd.scrollTop += row.getBoundingClientRect().top - pd.getBoundingClientRect().top - 40; return; }
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  function paint() {
    const v = view();
    const s = changes.scope(v), c = changes.of(v);
    if (!s || !c || c.state === "unsupported") return false; // stage.js keeps today's list
    const st = stOf(s.key);
    const act = changes.activity(v);
    const files = [...c.files.values()];
    // a file being written that the last read hasn't brought yet still shows, on top
    // (a project's own .xo/ is XO's, and Space never lists it there: nor does this)
    for (const p of act.live) if (!c.files.has(p) && (s.worktree || !p.startsWith(".xo/"))) files.unshift({ path: p, additions: null, deletions: null, status: "added", live: true });

    if (c.state === "loading" || c.state === "idle") {
      set("none", none, `<i class="spin" aria-hidden="true"></i> Reading what changed…`); none.hidden = false;
      list.hidden = true; pane.hidden = true; pill.hidden = true;
      return true;
    }
    if (c.state === "error" && !files.length) {
      set("none", none, esc(c.err || "Couldn't read what changed.")); none.hidden = false;
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

    // a long list draws its first SHOWN rows (and the chosen one); the rest on asking. Space itself lists at
    // most 500 and says how many there are in all.
    const rows = st.all || files.length <= SHOWN ? files : files.filter((f, i) => i < SHOWN || f.path === st.sel);
    const all = c.data && c.data.total_files > files.length ? c.data.total_files : files.length;
    const more = all - rows.length;
    set("list", list, rows.map((f) => rowHtml(f, st.sel, act.live)).join("") +
      (more > 0 ? `<li role="presentation"><button type="button" class="cx-more"${rows.length < files.length ? " data-cx-all" : " disabled"}>${rows.length < files.length ? `${(files.length - rows.length).toLocaleString()} more files · Show them` : `${more.toLocaleString()} more files, too many to list here`}</button></li>` : ""));
    const f = files.find((x) => x.path === st.sel);
    set("ph", ph, `<span class="cx-pp" title="${esc(f.path)}">${esc(f.path)}</span>${countsHtml(f)}<span class="cx-sp"></span><button type="button" class="cx-ofi" data-cx-open title="Open in Files: the whole file, side by side" aria-label="Open in Files">${OPEN_IC}</button>`);
    pane.hidden = false;
    set("pill", pill, st.pill ? `<i aria-hidden="true"></i><span><b>${esc(base(st.pill))}</b> ${st.pill === st.sel ? "updated" : "changed"}</span><span class="cx-show">Show</span>` : "");
    pill.hidden = !st.pill;
    pill.dataset.cxShow = st.pill || "";

    // the diff: following redraws on every agent edit (at its newest hunk); paused, only your own pick does
    const live = f.live ? null : f;
    if (!live) { draw(s.key, { ...f, binary: false, patch_omitted: null }, null); note.textContent = "Being written now…"; return true; }
    const shown = D.key === s.key && D.path === f.path;
    if (shown && !st.follow && D.patch && prevSel === st.sel) return true; // never redraw under you
    changes.patch(v, f.path).then((patch) => {
      if (stOf(s.key).sel !== f.path || changes.scope(view())?.key !== s.key) return;
      const line = shown && st.follow && D.patch && patch !== D.patch ? newestHunkLine(D.patch, patch) : null;
      draw(s.key, f, patch, { scrollTo: line });
    }).catch(() => { note.hidden = false; pd.hidden = true; note.textContent = "Couldn't read this file's change."; });
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
    const t = e.target;
    if (t.closest("[data-cx-all]")) { const s = changes.scope(view()); if (s) { stOf(s.key).all = true; onChange && onChange(); } return; }
    const r = t.closest("[data-cx]");
    if (r) { const s = changes.scope(view()); if (!s) return; const st = stOf(s.key); st.follow = false; st.sig = changes.activity(view()).sig; st.sel = r.dataset.cx; if (st.pill === st.sel) st.pill = null; onChange && onChange(); return; }
    if (t.closest("[data-cx-show]")) { const s = changes.scope(view()); if (!s) return; const st = stOf(s.key); st.sel = pill.dataset.cxShow || st.sel; st.pill = null; D.patch = null; D.pend = null; onChange && onChange(); return; }
    if (t.closest("[data-cx-open]")) { const s = changes.scope(view()); if (s && D.path) openFile(s, D.path, t.closest("[data-cx-open]")); }
  });
  // touching the diff (a scroll, a press, a key) is reading it: following pauses there
  for (const ev of ["wheel", "pointerdown", "keydown"]) pd.addEventListener(ev, pause, { passive: true });
  // J / K: the next or previous change in the diff (reading it: following pauses)
  host.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, [contenteditable]") || pd.hidden) return;
    const dir = K.is(e, "nextChange") ? 1 : K.is(e, "prevChange") ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    pause();
    DV.jump(pd, dir);
  });
  list.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...list.querySelectorAll(".cx-r")], i = rows.indexOf(document.activeElement);
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
      return { count: Math.max(c.files.size, (c.data && c.data.total_files) || 0), total: c.total, follow: stOf(s.key).follow, busy: changes.activity(v).busy };
    },
    /** A chip's click: this file, chosen by you (following pauses). */
    select(path) { const s = changes.scope(view()); if (!s) return false; const st = stOf(s.key); st.follow = false; st.sig = changes.activity(view()).sig; st.sel = path; st.pill = null; return true; },
    /** You handed the work back (a message sent), or pressed Follow: follow the agent again. */
    resume(v = view()) { const s = changes.scope(v); if (!s) return; const st = stOf(s.key); st.follow = true; st.pill = null; },
    toggleFollow() { const s = changes.scope(view()); if (!s) return; const st = stOf(s.key); if (st.follow) { st.follow = false; st.sig = changes.activity(view()).sig; } else { st.follow = true; st.pill = null; } },
    /** The file chosen in a view (its chip reads as chosen), or null. */
    chosen(v = view()) { const s = changes.scope(v); return s && ST.has(s.key) ? ST.get(s.key).sel : null; },
    /** Is a diff showing (the panel then asks for more width)? */
    get wide() { return !pane.hidden && !!D.handle; },
  };
}
