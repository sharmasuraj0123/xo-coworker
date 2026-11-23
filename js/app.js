// 17 · Converged. The final candidate of the round-4 research.
//
// Base: 16 · Budget's Home and UI (the owner's favourite), its sidebar,
// project page (title + one sentence + the Now shelf + All threads) and
// global panel; Today's in-thread card with smooth Details; Next's Workspace.
// Pacing is invisible: asks are ranked, small ones that block nobody wait
// quietly ("can wait", with the honest reason), destructive and stopped asks
// are never held, only high-leverage arrivals speak up, a break after ~25 min
// of deciding. Stop while anything runs. Intelligence per session in the
// composer. Light and dark.
import { createWorld, esc, WAITING } from "./world.js";
import { copyText, COPY_REFUSED, space } from "./util.js";
import { redraw } from "./redraw.js";
import "./dropdown.js"; // <xo-select>: the one dropdown, in place of the browser's <select>
import { renderMarkdown, renderInline, setThreadInfo, setWebImages } from "./markdown.js";
import * as Kit from "./kit.js";
import * as K from "./keys.js";
import { createDecisions } from "./decide.js";
import { createPacing } from "./pacing.js";
import { createIntel } from "./intel.js";
import { EFFORT, evidenceFor } from "./content.js";
import { keepTurning, DOTS, ARC, ICON, stepMark, stateMark, xi, XO, NEXT_GLYPH, $, $$, RM, clock, dayOf, short, elapsed, reconcile, sound, wait, hold, dial, morph, expand } from "./ui.js";
import { paidHtml } from "./paidview.js";
import { stopWords, uiMsg, forwardOrigin, echoes, threadAnchors, parseTarget as targetOf, stripTarget, sendErrorTitle, connLine, sendBlock, plainText, hopLine, sharedFileRoute, relayedInto, waitsForTurn, hopNotes, reactionGroups, pageFloor, inPage, canPageOlder, heldWords, heldShort, heldClock, heldBadge, soonestHeld } from "./timeline.js";
import { turnHtml, turnAv, turnSegments, segmentTurn } from "./turnview.js";
import { nameWith } from "./comms.js";
import { mediaHtml, fromAttachment, fromSharedFile, hydrateMedia, mediaItemOf, viewerFile, retryMedia, wireDragOut, webImagesHtml } from "./media.js";
// math and diagrams in a reply, drawn between keystrokes (KaTeX, Mermaid: vendored, loaded only when needed)
import { startRich } from "./rich.js";
import { createLightbox } from "./lightbox.js";
import { itemParts } from "./review.js";
import { headOf, goneLine } from "./cardparts.js";
import { runsStripHtml, runsListHtml, runViewHtml } from "./runsview.js";
import { createSettings } from "./settings.js";
import { createRuntimeSettings } from "./rtsettings.js";
import { createAccounts } from "./accounts.js";
import { createChats } from "./chats.js";
import { initFollow, toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest, createFollow } from "./follow.js";
import { decorateConversation } from "./msgx.js";
import { createViewer } from "./viewer.js";
import { createMap } from "./map.js";
import { createStage } from "./stage.js";
import { createLaunchpad } from "./launchpad.js";
import { createLpWindow } from "./lpwindow.js";
import { createLpPage } from "./lppage.js";
import { createLpApi } from "./lpapi.js";
import { createFiles, fileScope, localIn, scopeOf as filesScopeOf } from "./files.js";
import { createPaths } from "./paths.js";
import { createQuickOpen } from "./quickopen.js";
import { createFilesPage } from "./filespage.js";
import { createGhPage } from "./ghpage.js";
import { createChanges, lineRef, fileRef } from "./changes.js";
import { fileIcon } from "./fileicons.js";
import { countsHtml } from "./changesframe.js";
import { setTheme as setDiffTheme } from "./diffview.js";
import { createTray, fmtSize, kindOf, isLargePaste, pasteLabel, uploadErrorText, FINAL, MAX_FILES } from "./attach.js";
import { api, uploadAttachment } from "./api.js";
import { initCreate } from "./create.js";
import { classify, glyph, TOPICS } from "./projicons.js";
import { createShells } from "./shells/dock.js";
import { createRecord } from "./recordview.js";
import { greeting, today } from "./skeleton.js"; // Home's shell, drawn before this module graph arrives
import { arrive, still, EASE, MOVE } from "./motion.js";
import { createCalmOrder } from "./sideorder.js";
import { wireGestures, dockGestures, conversationGestures } from "./gestures.js";
import { rtName, rtMark, manyRuntimes, findRt, healthOf, canMove, untilWords } from "./runtimes.js";
// the UI's shape per person: which surfaces show, in what order, how dense, in which words (js/shape.js)
import { createShapeStore } from "./shape.js";
import { createShapeView, SHAPE_IC, UNKEPT } from "./shapeview.js";
import { setWorkMode } from "./turnview.js";
import { once, isPending, busyAttrs } from "./pending.js";
import { radioKeys, menuKeys, pointerFollows, focusOpened } from "./keynav.js";
import { STONE, FLAVOURS } from "./flavours.js";
import { createHerald, noticeFor, refusedNotice } from "./herald.js";
import { regionRings } from "./ring.js";
import { keepFocusInView, usable, hookOf } from "./focusview.js";

const world = createWorld();
// what the backend can do, asked each time (a surface that needs a missing one stays away); filled in below
const CAP = {};
// mine is Storm's where it keeps shapes (GET/PUT /api/chat/shape): read on load, written only on your change,
// another device's change heard on the stream; a conflict or a write that didn't land is said in the herald
const SHAPE = createShapeStore({
  caps: { has: (c) => !CAP[c] || CAP[c]() },
  remote: { get: () => api.shape(), put: (body) => api.putShape(body) },
  notice: (h) => heraldShow({ kind: "calm", ...h }, 6000),
});
world.onEvent((e) => { if (e.kind === "shape") SHAPE.heard(e.value); });
// pictures from the web in an agent's words (markdown's ![alt](https://…)) show like shared ones, unless this
// device's "Show pictures from the web" is off (the shape's xo:conversation/webpics): then they're links
const WEBPICS = "xo:conversation/webpics";
// A picture in the conversation's own folder (![alt](plots/fit.png)) always shows: it's the agent's own work, read
// from XO, not from a site; it's found the way a shared file is (fileRoute), else it's a card saying why it can't open.
setWebImages((list) => {
  const web = list.filter((x) => x.url), files = list.filter((x) => x.file);
  if (web.length && !SHAPE.on(WEBPICS)) return null;
  const own = files.map((x) => fromSharedFile({ path: x.file, name: x.file.split("/").pop(), title: x.alt || null }, { route: fileRoute }));
  if (!web.length) return mediaHtml(own, { side: "them" });
  return own.length ? mediaHtml(own, { side: "them" }) + webImagesHtml(web) : webImagesHtml(web);
});
startRich();
/** A noun in the shape's words (HTML). Where it isn't XO's own, XO's word stays in a tooltip, so help
 *  text and agents never disagree with the screen. */
const noun = (w) => { const x = SHAPE.word(w); return x === w ? esc(w) : `<span title="${esc(`XO's word: ${w}`)}">${esc(x)}</span>`; };

const params = new URL(location.href).searchParams;
const PROJ = (id) => (id === "workspace" ? "Workspace" : id === "@account" ? "Your account" : id === "@chats" ? "Chats" : world.project(id)?.name || id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const PHONE = matchMedia("(max-width: 760px)");
const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const num = (n) => NUM[n] || String(n);
const low = (n) => num(n).toLowerCase();
const plural = (n, w) => `${w}${n === 1 ? "" : "s"}`;
const DRAFTS = "cv-drafts:live";
// Stop's square: all of its 14 px box, with 4 px corners (css/app.css, .send.is-stop)
const STOP_ICON = ICON.stop;

// ── theme: a mode (dark by default, light, or the system's) and a flavour of the palette (css/flavours.css) ──
const LIGHT_OS = matchMedia("(prefers-color-scheme: light)");
const THEME = {
  pref() { try { const t = localStorage.getItem("cv-theme"); return t === "light" || t === "system" ? t : "dark"; } catch { return "dark"; } },
  get() { const p = THEME.pref(); return p === "system" ? (LIGHT_OS.matches ? "light" : "dark") : p; },
  flavour() { try { const f = localStorage.getItem("cv-flavour"); return f && /^[a-z-]+$/.test(f) ? f : "stone"; } catch { return "stone"; } },
};
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const f = THEME.flavour();
  if (f === "stone") delete document.documentElement.dataset.flavour; else document.documentElement.dataset.flavour = f;
  setDiffTheme(t); // a drawn diff follows at once (js/diffview.js)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", t);
  // the browser's own chrome (Safari's bars, Android's status bar) takes the canvas's colour
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim();
  if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvas);
  const b = $("#theme");
  if (b) {
    b.setAttribute("aria-checked", String(t === "light")); b.title = t === "light" ? "Light mode is on. Switch to dark" : "Switch to light mode";
    // an icon of the mode a press gives (the owner, 19 Nov: icons, no words, in the foot)
    const ic = `<span class="gear-ic" aria-hidden="true">${t === "light" ? ICON.moon : ICON.sun}</span>`;
    if (b._ic !== ic) { b.innerHTML = ic; b._ic = ic; }
  }
}
applyTheme(THEME.get());
LIGHT_OS.addEventListener("change", () => { if (THEME.pref() === "system") applyTheme(THEME.get()); });

// ── state ───────────────────────────────────────────────────────────────────
const S = {
  view: "home",            // home | ws | p:<project> | t:<thread>
  parent: {}, backTo: {}, scroll: {},
  dockFold: {},
  lref: {},                // beside a file: the lines a message will be about, per conversation {path, a, b, name}
  get showHops() { return SHAPE.on("xo:thread/hops"); },  // the shape's xo:thread/hops (cv-hops folded into this device's layer)
  tbOpen: {},              // storm blocks opened by the person (by block id, or row:<call id>)
  stops: new Map(),        // live Stops by session: waiting out their Undo, or on their way
  tEdit: null,             // a thread header field being edited: {tid, field: "title"|"label"}
  recording: null, keyErr: null,  // Settings › Keyboard: the action waiting for a new key, and why the last one was refused            // asks folded away in their thread so you can read it first (by ask key)
  local: {}, alias: new Map(),
  drafts: store.get(DRAFTS, {}),
  later: new Set(),
  pin: null,
  wash: new Map(),
  herald: null,
  ckOpen: {}, ckSeen: {}, ckFresh: null,
  handledOpen: false,
  desc: {},
  seen: null,
  allFilter: "all", allDone: false,
  trail: [],               // places visited before this one, for the phone's Back (a thread's own Back is its parent)
  n: 0,
};
const waitSince = new Map();
const live = $("#live");
// still(): asked again when the words go in, 40 ms later; false (a newer action answered meanwhile), nothing is said
function announce(text, still = null) { live.textContent = ""; setTimeout(() => { if (!still || still()) live.textContent = text; }, 40); }

// ── the parts ───────────────────────────────────────────────────────────────
const P = createPacing({ params });
// one card at the right edge: the newest shows, the one it covers steps aside and comes back when it closes
const EDGE = { under: null };
const edgeOver = (covered) => { if (covered.isOpen) { covered.park(); EDGE.under = covered; } };
const edgeBack = (from) => { const u = EDGE.under; if (u === from) { EDGE.under = null; u.unpark(); } };
const decisionsCard = { get isOpen() { return D.isOpen(); }, park: () => D.park(), unpark: () => D.unpark() };
const D = createDecisions({
  world, P, PROJ, announce, waitSince,
  onShown: () => edgeOver(VW),
  onGone: () => edgeBack(VW),
  render: () => schedule(),
  // the panel closed and what opened it isn't here: focus goes to the place at once, before the panel goes (its end
  // card, "That's everything", held focus and was removed with it: the page had it until the next draw, the
  // create-project grader on fc8dc92, S060/S158/C126/S163/S166), then to the same control in the draw that brings it
  // back, if one does (Home's card gives way to "Open in the panel" while the panel shows its ask: the controls
  // grader, S142)
  back: (sels) => { const here = placeRegion(); if (usable(here)) here.focus({ preventScroll: true }); S.focusNext = [...sels, placeRegion]; schedule(); },
  later: S.later,
  onOpenThread: (tid) => {
    // an item hosted by a chat (no thread) opens that conversation; one hosted by the account has no page yet
    const h = (world.state.hosts || []).find((x) => x.id === tid);
    if (h) { if (h.chatId) go(convOfChat(h.project), { keepPanel: true }); else if (h.plainSession) go("c:" + h.plainSession); else heraldShow({ kind: "calm", text: "It isn't tied to a conversation", sub: h.title }, 3600); return; }
    go("t:" + tid, { keepPanel: true });
  },
  // a decision refused after its window: the honest correction replaces "All clear"
  onNotSent: (title, why) => { setTimeout(() => heraldShow({ kind: "stopped", text: "Not sent", sub: `${String(title).replace(/`/g, "").replace(/[.?!]$/, "")} · ${why}`, force: true }, 7000), RM.matches ? 0 : 950); },
  onAllClear: (summary) => { setTimeout(() => heraldShow({ kind: "clear", text: "All clear", sub: summary }, 4600), RM.matches ? 0 : 900); },
  // a docked decision's own line ("Allowed. Undo") ends the moment its decision is undone, by its Undo or a key
  onUndone: (key) => { if (S.view === "home") { S.pin = key; S.pinAnim = "undo"; } for (const d of [TD, TP.dock?.TD]) if (d?.undone && d.undone.key === key) d.undone.end(); },
  onBreak: (left) => heraldShow({ kind: "calm", text: "Taking a break", sub: `${left} wait safely` }, 5200),
  onSent: (part) => {
    // "Stop here" after you stopped a thread: it ends there, honestly
    if (part.ask.stopByYou && part.choice && part.choice.option === "Stop here") setTimeout(() => { world.act.resolve(part.t.id).catch(() => {}); }, 1600);
  },
});
const IQ = createIntel({
  world, PROJ,
  // the shape's xo:composer/intel: "simple" opens Auto · Deep first, today's picker behind More options
  simple: () => SHAPE.opts("xo:composer/intel").mode === "simple",
  onChange: (o) => { for (const K of composers()) chipRender(o && o.fade, K); },
  record: (session, rec) => recordLine(session, rec),
  onMoved: (next, agent) => { announce(`Continuing on ${rtName(agent)}. This thread is frozen; write in it to pick it back up.`); if (next) go(`t:${next.id}`, { focus: true }); },
});

const CH = createChats({
  world, announce, heraldShow: (...a) => heraldShow(...a), go: (...a) => go(...a), schedule: () => schedule(),
  view: () => S.view,
  // a new chat that was refused: your words go back into an empty composer on the Chats page
  restore: (text, { force = false } = {}) => {
    if (force && S.view !== "chats") go("chats");
    if (S.view !== "chats") return false;
    if (say.value.trim() && !force) return false;
    putBack(text);
    return true;
  },
});
world.ui = { tbOpen: S.tbOpen }; // turn blocks open or folded, shared with the Chats view
// what a place changed, from Space's /changes (js/changes.js): the panel's Changes, Files' diffs, the chips' counts
const CHG = createChanges({ world, onChange: () => schedule() });
const VW = createViewer({
  announce, onChange: () => schedule(), changes: CHG,
  ask: { target: (f) => askPlace(f)?.name || null, send: askAboutLines, compose: (f, a, b) => composeAbout(f, a, b), file: (f) => askAboutFile(f) },
  // each save (⌘S): its place's changes are read again, once you pause
  edits: { saved: (f) => savedSoon(f) },
  // who made a version: an agent's thread, by its title
  threadTitle: (ts) => world.thread(ts)?.title || null,
  // Esc from a file: back to the panel's sections, the file kept as the Files tab (js/filespage.js)
  away: () => { if (!FP.isOpen) return false; STAGE.back(); return true; },
  // every way a file opens ends in the panel's Files page
  opened: (f, o) => { edgeOver(decisionsCard); FP.show(o); },
  closed: () => edgeBack(decisionsCard),
  // closed, with what opened it gone and nothing drawn in its place: where you'd carry on
  home: () => [$("#say"), placeRegion()].find(usable) || null,
}); // a file, in the panel's Files page (js/filespage.js)
// saves (⌘S): the place's changes are read again once they settle, not per save
const savedT = new Map();
function savedSoon(f) {
  const k = `${f.project}|${f.rel}`;
  clearTimeout(savedT.get(k));
  savedT.set(k, setTimeout(() => { savedT.delete(k); CHG.saved(f.project, f.rel); }, 2500));
}
// a file changed on disk (Space's file.version): the open file takes it in, and the place's file list follows
world.onEvent((e) => {
  if (e.kind !== "file") return;
  VW.fileChanged({ ...e.data, type: e.type });
  const d = e.data || {}, m = /^(\.xo\/worktrees\/[^/]+)\/(.+)$/.exec(d.path || "");
  if (d.project_id && (d.kind === "create" || d.kind === "delete" || d.kind === "rename")) {
    PATHS.changed({ project: d.project_id, base: m ? m[1] : "" }, { kind: d.kind, path: m ? m[2] : d.path, old_path: d.old_path ? d.old_path.replace(/^\.xo\/worktrees\/[^/]+\//, "") : null });
  }
});
// every file in a place (js/paths.js), for ⌘P and the tree's Find; ⌘P and ⌘⇧F themselves (js/quickopen.js)
const PATHS = createPaths({ api, onChange: () => { QO.refresh(); FILES.pathsChanged && FILES.pathsChanged(); } });
/** The place the view shows files of (a thread's worktree, a project's folder), or null. */
const placeNow = () => { const s = filesScopeOf(S.view, { thread: (id) => world.thread(id), project: (id) => PROJ(id) }); return s.key === "all" ? null : { project: s.project, base: s.base || "", label: s.label + (s.sub ? ` · ${s.sub}` : "") }; };
const QO = createQuickOpen({
  paths: PATHS, api, place: placeNow, announce,
  openFile: (rel, { line }) => VW.open({ path: rel, name: rel.split("/").pop(), project: placeNow().project, rel, ...(line ? { lines: [line, line] } : {}) }, null),
  openFiles: () => VW.openFiles || [],
  layer: { shown: () => syncInert(), hidden: () => syncInert() },
});
// a picture opens over the conversation (js/lightbox.js); Open in Files hands it to the viewer, which brings Files up
const LB = createLightbox({ openFile: (it, from) => VW.open(viewerFile(it), from), announce });
wireDragOut($("#msgs"));
// shells (js/shells/): the dock under the main column, the sidebar's Shells row, the top bar's Shell buttons
const SH = createShells({ PROJ, announce, notify: (h) => heraldShow(h, 6000), onChange: () => schedule(), wanted: () => SHAPE.on("xo:dock/shells") });
CAP.terminal = () => SH.available;
// a project's record: Since you left, Made, Recently made (design-research/12)
const REC = createRecord({ world, go: (v) => go(v), VW, PROJ, schedule: () => schedule(), announce, mark: (t) => threadMark(t, { lead: true }) });
REC.view = () => S.view;
/** A Shell button for the top bar: a count when shells already run there (it opens their list then). */

// ── world helpers ───────────────────────────────────────────────────────────
const projects = () => world.state.projects.filter((p) => p.id !== "workspace");
// Each project its own icon (js/projicons.js): from its name, and its threads' titles when the name says
// nothing. Offline and instant; worked out again only when the project's thread count changes. A project
// it can't place keeps the cube.
const projIcons = new Map();
// A project can wear the icon you chose for it (the owner, 19 Nov 14:44Z: "per project icons are fine"): one of the
// owner's topics or the cube, kept in your shape (layout.icons), so every device shows it; otherwise its own guess.
const ownIcon = (pid) => { const v = SHAPE.get("layout")?.icons?.[pid]; return typeof v === "string" && (v === "project" || TOPICS.includes(v)) ? v : null; };
function projectIcon(pid) {
  const ts = world.state.threads.filter((t) => t.project === pid);
  const own = ownIcon(pid);
  const memo = projIcons.get(pid);
  if (memo && memo.n === ts.length && memo.own === own) return memo.svg;
  const icon = own || classify((world.project(pid) || {}).name || pid, ts.map((t) => t.title || "")).icon;
  const svg = glyph(icon);
  projIcons.set(pid, { n: ts.length, own, svg });
  return svg;
}
/** The project icon picker: its header tile opens it; a grid of the owner's topics and the cube, "Automatic" first
 *  (its own guess, from its name and threads); arrows walk it, Enter or a click chooses, Esc closes. */
const PICK = { el: null, pid: null, from: null };
const topicName = (k) => (k === "project" ? "Cube" : k[0].toUpperCase() + k.slice(1));
function pickIcon(pid, from) {
  if (PICK.el && PICK.pid === pid) { closePick(); return; }
  closePick();
  const own = ownIcon(pid), name = PROJ(pid);
  const guess = classify((world.project(pid) || {}).name || pid, world.state.threads.filter((t) => t.project === pid).map((t) => t.title || "")).icon;
  const opt = (k, label, svg, on) => `<button type="button" class="pk-o${on ? " is-on" : ""}" role="radio" aria-checked="${on}" data-pk="${k}" title="${esc(label)}" aria-label="${esc(label)}" tabindex="${on ? 0 : -1}">${svg}</button>`;
  const el = document.createElement("div");
  el.className = "side-pop pk-pop"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `${name}'s icon`);
  el.innerHTML = `<div class="se-h"><b>${esc(name)}'s icon</b><span>Kept on every device you use. Automatic picks one from its name and threads.</span></div>` +
    `<div class="pk-grid" role="radiogroup" aria-label="Icons">${opt("", `Automatic (${topicName(guess)})`, `<span class="pk-auto">${glyph(guess)}<i>A</i></span>`, !own)}` +
    [...TOPICS, "project"].map((k) => opt(k, topicName(k), glyph(k), own === k)).join("") + `</div>`;
  document.body.append(el);
  const r = from.getBoundingClientRect();
  el.style.setProperty("--pop-x", `${Math.round(r.left - 8)}px`); el.style.setProperty("--pop-y", `${Math.round(r.bottom + 8 + 8)}px`);
  el.hidden = false;
  PICK.el = el; PICK.pid = pid; PICK.from = from;
  from.setAttribute("aria-expanded", "true");
  el.querySelector('.pk-o[tabindex="0"]').focus({ preventScroll: true });
  el.addEventListener("click", (e) => { const o = e.target.closest("[data-pk]"); if (o) chooseIcon(pid, o.dataset.pk); });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePick({ focus: true }); return; }
    const os = [...el.querySelectorAll(".pk-o")], i = os.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = Math.max(1, Math.round(el.querySelector(".pk-grid").clientWidth / os[0].offsetWidth));
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: os.length - 1 - i }[e.key];
    if (d == null) return;
    e.preventDefault();
    const j = Math.max(0, Math.min(os.length - 1, i + d));
    os[i].tabIndex = -1; os[j].tabIndex = 0; os[j].focus({ preventScroll: true });
  });
}
function closePick({ focus = false } = {}) {
  if (!PICK.el) return;
  PICK.el.remove(); PICK.from?.setAttribute("aria-expanded", "false");
  const back = $(`[data-pj-icon="${CSS.escape(PICK.pid)}"]`);
  PICK.el = null; PICK.pid = null; PICK.from = null;
  if (focus) back?.focus({ preventScroll: true });
}
function chooseIcon(pid, k) {
  SHAPE.patchMine({ layout: { icons: { [pid]: k || null } } });
  projIcons.delete(pid);
  closePick({ focus: true });
  announce(k ? `${PROJ(pid)} wears ${topicName(k)}` : `${PROJ(pid)}'s icon is automatic again`);
  render();
}
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-pj-icon]"); if (b) pickIcon(b.dataset.pjIcon, b); });
document.addEventListener("pointerdown", (e) => { if (PICK.el && !e.target.closest(".pk-pop,[data-pj-icon]")) closePick(); });
const threadsOf = (pid) => world.state.threads.filter((t) => t.project === pid && t.state !== "resolved");
const convThread = (v) => (v && v.startsWith("t:") ? world.thread(v.slice(2)) : null);
// the team, visible (js/comms.js): a comms call names the thread, project or coordinator it reached
nameWith({
  thread: (id) => world.thread(id)?.title || null,
  project: (chatId) => (world.state.projects || []).find((p) => p.chatId === chatId)?.name || null,
  here: () => { const v = S.view || ""; const t = convThread(v); return t ? PROJ(t.project) : v.startsWith("p:") ? PROJ(v.slice(2)) : null; },
});
const convProject = (v) => (v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : convThread(v)?.project);
const sessionOf = (v) => (v === "home" ? "ws" : v);
const askTitle = (n) => { const h = headOf(n); return (h.verb ? `${esc(h.verb)} ` : "") + (h.md ? renderInline(h.text, true) : esc(h.text)); };
const askShort = (n) => { const h = headOf(n); return [h.verb, h.md ? plainText(h.text) : h.text].filter(Boolean).join(" "); };
const STATE_WORD = { working: "Working", needs_reply: "Needs you", needs_approval: "Needs you", paused: "Paused", done: "Done", failed: "Stopped", resolved: "Resolved" };
// "Working" only while its agent really works: storm's `busy` (on a turn, or a sub-agent working on after it,
// never while it waits on you), kept live between reads by the same rule (timeline.js sessionBusy). The Working
// filter, the header's badge and sweep, the sidebar's count and the favicon's line all read it from here.
// A working thread whose session sits idle reads "Waiting" (the one vocabulary, 19 Nov; it read "Idle", P1-8).
const isBusy = (t) => t.busy === true || (t.state === "working" && t.busy !== false);
// held back by a gate (the usage limit, the paid gate, the founder's pause…): nothing runs, its next input waits
// (timeline.js heldOf). One shown state, as storm.js promotes it (threadState: a done, stopped or needs-reply thread
// whose input waits is "working"): never Working and never Idle, but "Waiting", with when it starts where a reset
// says it. An open item on it still reads Needs you (askingState), and a resolved one Resolved.
const isHeld = (t) => !!(t && t.held && !isBusy(t) && t.state === "working");
// a thread continued on another runtime is frozen, not waiting on you: a quiet "Continued" (F4)
// a stop someone meant (timeline.js stopOf) is drawn quiet, in the ink, never the red of a failure: "stopped"
const glyphOf = (t) => (isHeld(t) ? "paused" : t.state === "working" && t.busy === false ? "idle" : t.frozen ? "resolved" : t.stop ? "stopped" : t.state);
// an open thread whose agent sits idle is "Waiting": the word the panel, the header and All threads use (the owner, 19 Nov)
const wordOf = (t) => (isHeld(t) ? heldShort(t.held) : glyphOf(t) === "idle" ? "Waiting" : t.frozen ? "Continued" : STATE_WORD[t.state]);
// the state a badge or card is coloured by: a held thread in the pause's amber, never Working's blue
const stOf = (t) => (t.frozen ? "resolved" : isHeld(t) ? "paused" : t.stop ? "stopped" : t.state);
// a thread link in any message is a token led by that thread's live state (js/markdown.js)
setThreadInfo((id) => { const t = world.thread(id); return t ? { state: glyphOf(t), word: wordOf(t), title: t.title } : null; });
const SORT_STATE = { needs_approval: 0, needs_reply: 0, paused: 0, failed: 1, working: 2, done: 3, resolved: 4 };
// the Map (js/map.js): where your agents are working, beside the conversation; the viewer stacks over it
const MAP = createMap({ world, viewer: VW, go: (v) => go(v, { panel: true }), announce, isBusy, onChange: () => schedule(), openFile: (f, from) => VW.open(f, from) });
// the panel: one card on the right with tabs (Map, Made, File; later apps), one header button, ⌘\
// Files: the project's files, and the one place a file opens (js/files.js, design-research/13)
const FILES = createFiles({ world, viewer: VW, isBusy, PROJ, go: (v) => go(v), changes: CHG, onFold: (f) => FP.treeFolded(f), paths: PATHS });
// Files is a page of the panel (js/filespage.js); otherwise the panel is a stack of frames: Threads · Changes · Map
// Launchpad (js/launchpad.js): Deploy in the header row of a project and a thread opens it in its window (js/lpwindow.js)
const lpProject = (v) => (v && v.startsWith("p:") ? v.slice(2) : v && v.startsWith("t:") ? world.thread(v.slice(2))?.project || null : null);
// the thread "Ask an agent" started: by its id when Launchpad has it (whatever its title, past older threads of the
// same title; resolved reads as done); without one, discovered by xo-space's title "Deploy to Launchpad", while open
const lpThread = (p, id) => { const t = id ? world.thread(id) : world.state.threads.find((x) => x.project === p && /^deploy to launchpad/i.test(x.title || "") && x.state !== "resolved"); return t && t.project === p ? { thread: t.id, title: t.title, since: t.createdAt, busy: isBusy(t), held: isHeld(t) ? heldShort(t.held) : null, done: t.state === "done" || t.state === "resolved" } : null; };
const LP = createLaunchpad({ api: createLpApi(), projectOf: lpProject, nameOf: (p) => PROJ(p), findThread: lpThread, go: (v) => { LW.close(); go(v); }, announce, onChange: () => schedule(),
  // Launchpad's own Undo names where focus goes (Stop, the header's Deploy, the page's work): ownFocus
  // and its kind: a failure ("err") reads as every failure notice here does (kind "stopped": the error's mark and
  // ink), never with the success check (Launchpad grader on 842a6d1: "Couldn't unlink" showed a green check)
  notify: (text, undo, kind = "done") => heraldShow({ kind: kind === "err" ? "stopped" : kind, text, ...(undo ? { undo, undoUntil: Date.now() + 3000, ownFocus: true } : {}) }, undo ? 3200 : kind === "err" ? 6000 : 4200),
  // one notice per subject (a stop, an unlink: mid), changed in place as it goes on, or taken away (C041's pattern;
  // the owner's choice B): its Undo's deadline is the action's own (l.until), so it can't outlive what it undoes
  notice: (mid, l, ms) => { const h = { mid, kind: l.kind === "err" ? "stopped" : l.kind || "done", text: l.text, ...(l.sub ? { sub: l.sub } : {}), ...(l.undo ? { undo: l.undo, undoLabel: l.undoLabel, undoUntil: l.until || 0, ownFocus: true } : {}) }; return heraldFor(mid, () => h, ms) || heraldShow(h, ms); },
  unnotice: (mid) => heraldDrop(mid) });
const LW = createLpWindow({ launch: LP, projectOf: lpProject, nameOf: (p) => PROJ(p), iconOf: (p) => (p ? projectIcon(p) : ""), allApps: () => go("launchpad"), onChange: () => schedule() });
const LPP = createLpPage({ el: $("#lpp"), launch: LP, projects: () => projects().map((p) => p.id), iconOf: (p) => projectIcon(p), open: (v, from) => LW.open(v, from), press: (name) => LW.press(name) });
// the places that are a page of their own rather than a conversation, each its own section
const PAGE_OF = { home: "#home", artifacts: "#arts", launchpad: "#lpp" };
const pageEl = (v) => (PAGE_OF[v] ? $(PAGE_OF[v]) : null);
// the panel is a project's: its chat, the Workspace's, and their threads; Home, Chats, Artifacts and the rest have none
const panelPlace = (v) => /^(?:ws$|[pt]:)/.test(v || "");
const STAGE = createStage({ place: panelPlace, map: MAP, files: FILES, changes: CHG, openFiles: () => FP.show({ focus: true }), github: { show: () => GH.show(), has: (v) => (lpProject(v) && lpProject(v) !== "workspace" ? GH.has(lpProject(v)) : Promise.resolve(false)) }, viewer: VW, view: () => S.view, go: (v, e) => openFromPanel(v, e), announce, onChange: () => schedule(), frames: () => SHAPE.list("panel").map((s) => s.id.slice("xo:panel/".length)), threads: (v) => panelThreads(v), shell: (on, host, where) => panelShell(on, host, where), owns: (e) => SH.owns(e) });
// Files, a page of the panel (js/filespage.js; the owner, 19 Nov 14:57Z): the tree and the file open beside the chat,
// which never moves
const FP = createFilesPage({ stage: STAGE, files: FILES, viewer: VW, view: () => S.view, announce });
const GH = createGhPage({ stage: STAGE, api, view: () => S.view, projectOf: lpProject, go: (v) => go(v), announce });
// the place beside the panel's name: a thread's project (its title is the conversation's own head), a project
STAGE.names = (v) => {
  const p = v.startsWith("t:") ? world.thread(v.slice(2))?.project : v.startsWith("p:") ? v.slice(2) : null;
  return p && p !== "workspace" ? PROJ(p) : p === "workspace" || v === "ws" ? "Workspace" : "Your projects";
};
REC.panel = STAGE;
/** The runtime a thread runs on, fixed for its life (its session's agent). */
const agentOf = (t) => (t && ((t.session && t.session.agent) || (t.sessionId && world.state.sessions[t.sessionId]?.agent))) || null;
/** A thread's agent as its company's mark (js/runtimes.js rtMark), wherever a thread is listed (the owner, 19 Nov:
 *  "show that this is a claude thread or a codex thread"), when there's more than one runtime to tell apart; its name
 *  on hover and to a screen reader; nothing for a runtime without a mark or a thread whose agent isn't known yet. */
const threadMark = (t, opts) => { const a = agentOf(t); return a && manyRuntimes(world.state.runtimes) ? rtMark(a, opts) || "" : ""; };
const threadAgentWords = (t) => { const a = agentOf(t); return a && manyRuntimes(world.state.runtimes) ? `, on ${rtName(a)}` : ""; };
const RT_EFFORT = { low: "Quick", medium: "Balanced", high: "Deep", xhigh: "Deeper", max: "Deepest" };
/** When the usage limit that holds a thread lets it start (ISO), or null. Only while the thread is held, and by the
 *  limit (or by a gate an older backend doesn't name): its session's word (timeline.js heldOf), else the open limit
 *  item that names it. Never for a thread at work, whatever an item still says. Only a time still ahead. */
function waitingOn(t) {
  if (!isHeld(t) || (t.held.for && t.held.for !== "limit")) return null;
  const lim = (t.limits || [])[0];
  const at = t.held.until || (lim && lim.limit && lim.limit.resetsAt) || null;
  return at && Date.parse(at) > Date.now() ? at : null;
}
/** F1: which runtime a thread runs on, said only when there is more than one runtime to tell apart. */
function rtTag(t, cls) {
  const rts = world.state.runtimes;
  const agent = agentOf(t);
  if (!agent) return "";
  const many = manyRuntimes(rts);
  // F5: a thread held by its runtime's usage limit says until when, in the header: with one runtime too (it
  // waits all the same; there the runtime needs no name)
  const wait = cls !== "ar" && waitingOn(t);
  if (wait) {
    // beside the badge's "Waiting": what it waits for and when it starts ("Usage limit · starts 6:50 AM"), the verb
    // the line under the conversation and the sidebar use too (timeline.js heldWords)
    const who = many ? rtName(agent) : "";
    const tip = `${who || "Your agent"} reached its usage limit. This thread starts on its own ${heldClock(wait)}${untilWords(wait) ? `, ${untilWords(wait)}` : ""}.`;
    return `<button type="button" class="tw-rt is-warn" data-set-open="runtimes" title="${esc(tip)}" aria-label="${esc(`${tip} Open Runtimes in Settings.`)}">${who ? `${esc(who)} limit` : "Usage limit"} · starts ${esc(heldClock(wait))}</button>`;
  }
  if (!many) return "";
  const rt = findRt(rts, agent), h = healthOf(rt), se = t.session || {};
  const ver = rt && rt.health && rt.health.cli_version;
  const tip = [`Runs on ${rtName(agent)}${ver ? ` ${ver}` : ""}`, se.model || "its default model", se.effort ? RT_EFFORT[se.effort] || se.effort : ""].filter(Boolean).join(" · ") +
    `. ${h.key === "usable" ? `${rtName(agent)} is usable.` : `${h.word}.${h.why ? ` ${h.why}` : ""}`}`;
  const warn = h.tone === "bad" || h.tone === "warn" ? " is-warn" : "";
  // a list names only the exceptions: a thread on the Space's usual runtime needs no word there
  // a list row shows every thread's agent as a mark before its title (threadMark): here only a runtime in trouble is named
  if (cls === "ar" && !warn) return "";
  // a shape without runtime names (xo:thread/runtime) still says when the runtime is in trouble
  if (!warn && !SHAPE.on("xo:thread/runtime")) return "";
  // its company's mark (js/runtimes.js rtMark): alone in a list row, the name beside it in the header; a runtime
  // without a mark keeps its name
  return cls === "ar" ? `<span class="ar-r${warn}" title="${esc(tip)}">${rtMark(agent) || esc(rtName(agent))}<span aria-hidden="true"> · </span></span>`
    : `<button type="button" class="tw-rt${warn}" data-set-open="runtimes" title="${esc(tip)}" aria-label="${esc(tip)} Open Runtimes in Settings.">${rtMark(agent, { withName: true }) || esc(rtName(agent))}</button>`;
}
/** F7: what a runtime does with a message sent while its turn runs: "steered" (joins it) or "queued". */
const sendWhileRunning = (t) => {
  const rt = findRt(world.state.runtimes, agentOf(t)); const f = rt && rt.features && rt.features.features && rt.features.features.send_while_running;
  return (f && f.behaviour) || null;
};
/** F4: a thread may continue elsewhere when another runtime its project allows can take work now, once. */
const movable = (t) => !!(world.act.storm && world.act.policyFor && t && !t.movedTo && agentOf(t) && world.act.policyFor(t.project) && canMove(agentOf(t), world.act.policyFor(t.project), world.state.runtimes));
/** The composer's target line in a thread; while its agent works, where your words land. */
function threadTargetHtml(t) {
  if (t.frozen) return `<span class="tg-t">${ICON.thread}</span><span><span class="tg-w">Reply in </span><b>this ${noun("thread")}</b></span><span class="muted">· sending picks it back up</span>`;
  const how = isBusy(t) && t.state !== "resolved" ? sendWhileRunning(t) : null;
  const tail = how === "steered" ? `<span class="muted">· sent into the current turn</span>` : how === "queued" ? `<span class="muted">· queued for the next turn</span>` : "";
  return `<span class="tg-t">${ICON.thread}</span><span><span class="tg-w">Reply in </span><b>this ${noun("thread")}</b></span>${tail}`;
}
const doneToday = () => world.state.threads.filter((t) => t.state === "done" && new Date(t.lastAt).toDateString() === new Date().toDateString());

// ── events: a calm labelled line, never the composer, never a quiet row ────
world.onEvent((e) => {
  if (e.kind === "message") {
    // the coordinator answered something you asked, and you're looking elsewhere: one calm line
    const conv = e.project === "workspace" ? "ws" : "p:" + e.project;
    if (e.answered && S.view !== conv) heraldShow({ kind: "reply", text: e.project === "workspace" ? "The coordinator replied" : `${PROJ(e.project)} coordinator replied`, sub: short1(e.text), open: conv }, 7000);
    if (e.answered) announce(`${e.project === "workspace" ? "The coordinator" : PROJ(e.project) + " coordinator"} replied: ${e.text}`);
    schedule();
    return;
  }
  const t = e.thread ? world.thread(e.thread) : null;
  const pid = e.project;
  if (e.kind === "ask" && t && !waitSince.has(t.id)) waitSince.set(t.id, Date.now());
  if (e.kind === "resumed" && t) waitSince.delete(t.id);
  if (!pid || pid === "workspace") return;
  // F5: threads moved off a closed limit arrive one by one; each says where it went
  if (e.kind === "moved" && t && !IQ.movedHere(t.id)) { heraldShow({ kind: "done", text: `${t.title} continues on ${rtName(e.agent)}`, sub: PROJ(pid), open: e.to ? "t:" + e.to : "t:" + t.id }, 5200); return; }
  if (e.kind === "done" && t) heraldShow({ kind: "done", text: `${t.title} finished`, sub: PROJ(pid), open: "t:" + t.id }, 5200);
  else if (e.kind === "state" && t && t.state === "failed") heraldShow({ kind: "stopped", text: `${t.title} stopped`, sub: PROJ(pid), open: "t:" + t.id }, 5200);
});

const short1 = (text) => { const s = String(text || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim(); return s.length > 64 ? s.slice(0, 63).replace(/\s+\S*$/, "") + "…" : s; };

/** Leverage-gated pings: only a newly arrived ask that frees ≥ 1 h of agent work may speak, once. */
function pings(needs) {
  if (!S.seen) { S.seen = new Set(needs.map((n) => n.key)); return; }
  for (const n of needs) {
    if (S.seen.has(n.key)) continue;
    S.seen.add(n.key);
    if (n.group === "stopped" || n.ask.stopByYou || !P.mayPing(n)) continue;
    // never the same ask twice on one screen: Home lists it, and its own thread shows it above the composer
    if (S.view === "home" || S.view === `t:${n.t.id}`) continue;
    heraldShow({ kind: "ping", text: `${PROJ(n.t.project)} · worth a look`, sub: askShort(n), decide: n.key }, 7000);
  }
}

// ── sidebar: button-like rows; text only when a project needs you (#27) ────
const SIDE_CALM = Object.assign(createCalmOrder(), { over: false, pending: false, t: 0 });
function sideRender(needs) {
  const mine = needs.filter((x) => x.admitted && !x.later);
  const n = mine.length;
  const hn = $("#home-n");
  const hnHtml = n ? `<span class="nv-dot" aria-hidden="true"></span>${n}` : "";
  if (hn._h !== hnHtml) { redraw(hn, hnHtml); hn._h = hnHtml; }
  $("#nv-home").setAttribute("aria-label", n ? `Home, ${n} need you` : "Home, nothing needs you");
  // the Workspace's own coordinator asking: the same amber mark on its row, as a project's row has
  const wsN = mine.filter((x) => x.t.host && x.t.project === "workspace").length;
  const wnHtml = wsN ? `<span class="nv-dot" aria-hidden="true"></span>${wsN}` : "";
  const wn = $("#ws-n");
  if (wn._h !== wnHtml) { redraw(wn, wnHtml); wn._h = wnHtml; }
  $("#nv-ws").setAttribute("aria-label", wsN ? `Workspace, its coordinator needs you` : "Workspace");
  $("#nv-home").classList.toggle("is-on", S.view === "home");
  $("#nv-ws").classList.toggle("is-on", S.view === "ws");
  $("#nv-chats").classList.toggle("is-on", CH.isChats(S.view));
  $("#nv-arts").classList.toggle("is-on", S.view === "artifacts");
  $("#nv-lp").classList.toggle("is-on", S.view === "launchpad");
  // the Artifacts row's count is quiet: a number, never a signal
  { const n = REC.artifacts.count(); const t = n ? String(n) : ""; if ($("#arts-n").textContent !== t) $("#arts-n").textContent = t; $("#nv-arts").setAttribute("aria-label", n ? `Artifacts, ${n}` : "Artifacts"); }
  // (aria-current="page": an empty aria-current, as toggleAttribute writes it, reads as false)
  for (const b of [$("#nv-home"), $("#nv-ws"), $("#nv-chats"), $("#nv-arts"), $("#nv-lp")]) if (b.classList.contains("is-on")) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  $("#nv-more").classList.toggle("is-on", !!$("#side .nav .nrow.is-on[hidden]")); // a place kept in More marks More
  const now = Date.now();
  const rows = projects().map((p) => {
    const on = S.view === "p:" + p.id || convThread(S.view)?.project === p.id;
    const asks = mine.filter((x) => x.t.project === p.id);
    const lead = asks.find((x) => x.group !== "stopped" && x.risk !== "destructive") || asks[0];
    // every thread with work running counts, a resolved one too (its turn or sub-agents can outlive the
    // resolve), and so does the project's coordinator while it's on a turn
    const nBusy = world.state.threads.filter((t) => t.project === p.id && (t.state === "resolved" ? t.busy === true : isBusy(t))).length;
    const coordBusy = !!world.act.coordinatorBusy(p.id);
    const busy = nBusy > 0 || coordBusy;
    const needsMe = asks.length > 0;
    // hub #31: a project at work reads blue at a glance; what needs you (amber, red) still wins the row
    const working = busy && !needsMe;
    // held back by a gate (the usage limit…), nothing of it running: a quiet "Waiting", never Working; of several,
    // the one that starts soonest
    const held = !busy && !needsMe ? soonestHeld([...world.state.threads.filter((t) => t.project === p.id && isHeld(t)).map((t) => t.held), world.act.coordinatorHeld && world.act.coordinatorHeld(p.id)]) : null;
    const label = needsMe ? askShort(lead) : working ? (nBusy > 1 ? `${nBusy} threads working` : nBusy ? "Working" : "Coordinator working") : held ? heldShort(held) : "";
    const kind = needsMe ? (lead.risk === "destructive" || lead.group === "stopped" ? "red" : "amber") : "";
    const was = sideRender.needs?.get(p.id) || 0;
    if (asks.length > was && sideRender.ready && !RM.matches) S.wash.set(p.id, { n: (S.wash.get(p.id)?.n || 0) + 1, until: now + 2600 });
    const w = S.wash.get(p.id);
    const washing = w && w.until > now;
    return { key: p.id, html:
      `<button type="button" class="prow${needsMe ? ` needs k-${kind}` : working ? " busy" : ""}${on ? " is-on" : ""}${washing ? " wash" : ""}" data-go="p:${esc(p.id)}" data-w="${washing ? w.n : 0}"${on ? ' aria-current="page"' : ""} aria-label="${esc(p.name)}${needsMe ? `. ${asks.length} need${asks.length === 1 ? "s" : ""} you: ${esc(label)}` : busy ? ". Working" : held ? `. ${esc(heldWords(held))}` : ""}"${SIDE.folded ? ` title="${esc(p.name)}${needsMe ? ` · ${asks.length} need${asks.length === 1 ? "s" : ""} you` : busy ? " · Working" : ""}"` : ""}>` +
      `<span class="pr-ic" aria-hidden="true">${projectIcon(p.id)}${busy && needsMe ? `<i class="pr-busy"></i>` : ""}</span>` +
      `<span class="pr-main"><span class="pr-l1"><span class="pr-name">${esc(p.name)}</span>${needsMe ? `<span class="pr-w" aria-hidden="true"><i class="pr-d"></i>${asks.length}</span>` : ""}</span>` +
      (label ? `<span class="pr-t">${esc(label)}</span>` : "") + `</span></button>`, active: busy || needsMe, urgent: needsMe };
  });
  const held = SIDE_CALM.over || ($("#side").matches(":focus-within") && !!document.activeElement?.matches(":focus-visible"));
  const calm = SIDE_CALM.order(rows.map((r) => ({ id: r.key, active: r.active, urgent: r.urgent })), now, { first: !sideRender.ready, held });
  SIDE_CALM.pending = calm.pending;
  clearTimeout(SIDE_CALM.t);
  if (calm.next != null) SIDE_CALM.t = setTimeout(() => sideRender(D.needItems()), calm.next + 50);
  const up = new Set(calm.top);
  const items = [...rows.filter((r) => up.has(r.key)), ...(up.size && up.size < rows.length ? [{ key: "pr-sep", html: `<div class="pr-sep" aria-hidden="true"></div>` }] : []), ...rows.filter((r) => !up.has(r.key))];
  const box = $("#projects"), sig = items.map((r) => r.key).join();
  const from = sideRender.ready && sig !== sideRender.sig && !still() ? new Map([...box.children].map((el) => [el, el.getBoundingClientRect().top])) : null;
  sideRender.needs = new Map(projects().map((p) => [p.id, mine.filter((x) => x.t.project === p.id).length]));
  // a row that changes (where you are, a count) is updated in place: its lines stay, so nothing replays its entrance
  reconcile(box, items, { quiet: !sideRender.ready });
  sideRender.sig = sig;
  if (from) for (const [el, y] of from) { const dy = el.isConnected ? y - el.getBoundingClientRect().top : 0; if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: MOVE, easing: EASE }); }
  sideRender.ready = true;
}
{
  const side = $("#side"), settle = () => { if (SIDE_CALM.pending) setTimeout(() => !SIDE_CALM.over && sideRender(D.needItems()), 800); };
  side.addEventListener("pointerenter", () => { SIDE_CALM.over = true; });
  side.addEventListener("pointerleave", () => { SIDE_CALM.over = false; settle(); });
  side.addEventListener("focusout", (e) => { if (!side.contains(e.relatedTarget)) settle(); });
}

// ── Home ────────────────────────────────────────────────────────────────────
// Before the world loads, Home is js/skeleton.js's shell: the greeting, and each block's frame in its
// final place and size. Each block's real content replaces its stand-in and arrives (motion.js);
// the frames don't move, so nothing below them does either.
/** A block whose stand-in was showing: its real content arrives now. */
function landed(el, parts = el ? [...el.children] : []) {
  if (!el || !el._sk) return;
  el._sk = false;
  parts.forEach((c, i) => c && arrive(c, { delay: i * 40 }));
}
/**
 * Draw a region's HTML when it changed, in place (js/redraw.js): what stays is the same node, only what changed is
 * written. Live data redraws regions several times a second while agents work; a region drawn anew with innerHTML
 * replaced the control under a press, and the browser drops a click whose pressed node left the page (the owner, 19 Nov:
 * Back and folders needed several clicks). The control with focus, or under a press, is never moved or replaced. If the
 * focused control itself went, the same control drawn again (by its data-fid, else id, else data- hooks) takes focus.
 */
function patch(el, html) {
  if (el._h === html) return false;
  const a = document.activeElement;
  let sel = null;
  if (a && a !== el && el.contains(a)) {
    if (a.dataset.fid) sel = `[data-fid="${CSS.escape(a.dataset.fid)}"]`;
    else if (a.id) sel = `#${CSS.escape(a.id)}`;
    else { const d = [...a.attributes].filter((x) => x.name.startsWith("data-")); if (d.length) sel = a.tagName.toLowerCase() + d.map((x) => (x.value ? `[${x.name}="${CSS.escape(x.value)}"]` : `[${x.name}]`)).join(""); }
  }
  redraw(el, html); el._h = html;
  if (sel && !a.isConnected) el.querySelector(sel)?.focus({ preventScroll: true });
  return true;
}
function homeParts(needs = D.needItems()) {
  const adm = needs.filter((n) => n.admitted);
  const active = adm.filter((n) => !n.later);
  const next = active.find((n) => n.key === S.pin) || active[0] || null;
  S.pin = next ? next.key : null;
  const rest = active.filter((n) => n !== next);
  return { needs, adm, active, next, then: rest.slice(0, 2), more: rest.slice(2), later: adm.filter((n) => n.later), held: needs.filter((n) => n.held), glances: active.filter((n) => n.effort === "glance" && Kit.isBinary(n.ask) && n.group === "routine") };
}

/** An answer button; a preview, when there is one, sits in a small swatch so the button never looks disabled. */
function optHtml(o, i, ev) {
  const pv = ev && ev.preview ? ev.preview.find((p) => p.label === o) : null;
  return `<button type="button" class="b b-opt${pv ? " has-pv" : ""}" data-fid="opt${i}" data-nx-opt="${i}" title="Answer “${esc(o)}”">${pv ? `<span class="o-pv" aria-hidden="true"><span class="o-s" style="${esc(pv.css)}">${esc(pv.sample || o)}</span></span>` : ""}<span class="o-l">${esc(o)}</span></button>`;
}
/** Home's answers: a glance answered in place, anything more opens the panel; the row is the panel card's. */
function nextActHtml(n) {
  const a = n.ask;
  const binary = Kit.isBinary(a);
  const details = `<button type="button" class="b b-ghost b-later" data-fid="ev" data-decide="${esc(n.key)}" title="Open it in the panel"><span class="b-l">${ICON.eye}Details</span></button>`;
  let html = "";
  if (n.effort === "glance" && Array.isArray(a.options) && !binary) {
    const ev = evidenceFor(n);
    html += `<div class="c-opts n${Math.min(a.options.length, 3)}" role="group" aria-label="Answers">${a.options.map((o, i) => optHtml(o, i, ev)).join("")}</div>` +
      `<div class="c-btns"><button type="button" class="b b-back" data-fid="back" data-nx-back><span class="b-l">${ICON.rewind}Send back</span></button>${details}</div>`;
  } else if (n.effort === "glance" && binary) {
    // a storm item's answers keep the server's own words (Allow once, Deny, Approve…)
    const IP = a.item ? itemParts(a.item) : null;
    const yes = IP && IP.primary ? IP.primary.label : "Allow", no = IP && IP.back ? IP.back.label : "Send back";
    html += `<div class="c-btns"><button type="button" class="b b-allow" data-fid="allow" data-nx-allow><span class="b-l">${ICON.check}${esc(yes)}</span></button><button type="button" class="b b-back" data-fid="back" data-nx-back><span class="b-l">${ICON.rewind}${esc(no)}</span></button>${details}</div>`;
  } else {
    const verb = n.group === "stopped" ? "Look and choose" : n.risk === "destructive" ? "Read it closely" : n.ask.kind === "action" ? "See what it needs" : n.ask.replyOnly ? "Read and reply" : "Decide";
    html += `<div class="c-btns"><button type="button" class="b b-go" data-fid="go" data-decide="${esc(n.key)}"><span class="b-l">${verb}${ICON.arrow}</span></button>` +
      (n.effort === "think" ? `<button type="button" class="b b-ghost b-later" data-fid="later" data-later="${esc(n.key)}" title="Park it until later today"><span class="b-l">${ICON.clock}Later today</span></button>` : "") + `</div>`;
  }
  // a Send back that didn't go comes back with its note, open, to send again
  const kept = D.failedNote(n.key);
  html += `<div class="c-note nx-note"${kept ? "" : " hidden"}>${kept ? `<p class="c-hint show stay" role="status">That didn't send. Your note is still here: Send back tries again.</p>` : ""}<label for="nx-note-in" class="c-note-l">What should it do instead? (optional)</label><textarea id="nx-note-in" rows="2" placeholder="e.g. what it should try instead">${esc(kept)}</textarea>` +
    `<div class="c-note-row"><button type="button" class="b b-sm b-go" data-nx-send>${ICON.rewind}Send back</button><button type="button" class="b b-sm b-ghost" data-nx-cancel>Cancel</button></div></div>`;
  return html;
}
const NEXT_SEEN = new Map(); // Home's next ask → when it last became the current card (its re-arm runs from then)
function nextCardHtml(n) {
  const t = n.t, P = D.parts;
  const where = t.host
    ? `<button type="button" class="c-where" data-fid="where"${t.chatId ? ` data-go="${esc(convOfChat(t.project))}"` : t.plainSession ? ` data-go="c:${esc(t.plainSession)}"` : ""} title="${t.asker ? `Open ${esc(PROJ(t.project))}, where its coordinator asks` : "Where it was asked"}">${t.asker ? `${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b>` : esc(t.title)}</button>`
    : `<button type="button" class="c-where" data-fid="where" data-go="t:${esc(t.id)}" title="Open the thread">${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b></button>`;
  const chips = P.chipsHtml(n);
  return `<article class="next r-${n.risk} e-${n.effort}${D.failedNote(n.key) ? " noting" : ""}" data-key="${esc(n.key)}" data-fid="nextcard" tabindex="-1" aria-labelledby="nx-h">` +
    `<div class="stamp stamp-allow" aria-hidden="true">${ICON.stampAllow}</div>` +
    `<div class="nx-in"><div class="c-body">` +
    `<div class="c-top">${P.effTagHtml(n)}${where}</div>` +
    P.leadHtml(n, "nx", "h2") +
    (chips ? `<div class="c-chips"><ul class="chips" aria-label="About this">${chips}</ul></div>` : "") +
    `</div><div class="c-act">${nextActHtml(n)}</div></div></article>`;
}

function homeRender(needs) {
  const box = $("#home");
  if (!box._built) {
    box.innerHTML = `<div class="hm"><div id="hm-head"></div><div class="hm-body" id="hm-body"><div id="hm-since"></div><div id="hm-next"></div><div id="hm-then"></div><div id="hm-end"></div><div id="hm-made"></div></div></div>`;
    box._built = true;
  }
  const P0 = homeParts(needs);
  const working = world.state.threads.filter(isBusy);
  const date = today();
  const act = P0.active.length;
  let sub;
  if (act) sub = act === 1 ? "One thing is worth your time." : `${num(act)} things are worth your time.`;
  else sub = P0.held.length ? "Nothing needs you now." : "Nothing needs you.";
  const down = (world.state.error || world.state.statusError) && !world.state.threads.length;
  if (down) sub = "XO can't be reached right now.";
  const hello = greeting();
  // Create XO Project stays in Home's header, always: the one invitation to start something, beside the
  // sidebar's "+ New" (the owner, 4 Nov: hiding it once a project existed made it hard to find)
  patch($("#hm-head"), `<header class="hm-top"><div class="hm-hd"><p class="hm-date">${esc(date)}</p><h1 class="hm-h" id="home-h">${hello}.<span> ${sub}</span></h1></div>` +
    `<button type="button" class="create" data-create data-fid="create"><span class="create-ic">${ICON.plus}</span><span class="cr-l">Create XO Project</span><span class="cr-s">New project</span></button></header>`);
  landed($("#hm-head"), [$("#home-h span"), $("#hm-head .create")]); // the greeting was already there: only the words after it arrive

  // the next move (stays put until it's done)
  const nb = $("#hm-next");
  const card0 = nb.querySelector(".next");
  const nextHad = nb.contains(document.activeElement);
  const inPanel = P0.next && D.current() === P0.next.key;
  if (card0 && (card0.classList.contains("noting") || card0._busy) && P0.next && card0.dataset.key === P0.next.key) { /* don't disturb a note in progress */ }
  else if (P0.next && inPanel) {
    nb._key = null;
    patch(nb, `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>Your next move</p><p class="in-panel">${ICON.arrow}<span>Open in the panel</span></p>`);
  } else if (P0.next) {
    const key = P0.next.key;
    const changed = nb._key !== key;
    // each time an ask becomes the card shown here (first, or back after an Undo, or back from the panel), its
    // 300 ms re-arm starts again: a press meant for the card before can't land on it (Astra, fa6d783 Undo path)
    if (changed) NEXT_SEEN.set(key, performance.now());
    const html = `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>Your next move</p>` + nextCardHtml(P0.next);
    if (patch(nb, html) && changed) {
      const card = nb.querySelector(".next");
      if (nb._key && !RM.matches) card.classList.add(S.pinAnim === "undo" ? "in-undo" : "in-next");
      S.pinAnim = null;
    }
    nb._key = key;
  } else {
    nb._key = null;
    const w = working.length;
    if (down) patch(nb, `<div class="calm is-down"><div class="calm-mark">${XO}</div><h2>Can't reach XO.</h2><p>Retrying every few seconds. Nothing you write is lost; sending waits until it's back.</p></div>`);
    // the headline already says "Nothing needs you." (say it once): one quiet line under it
    else patch(nb, `<p class="calm-line">${w ? `${num(w)} ${noun(plural(w, "thread"))} working. ${w === 1 ? "It'll" : "They'll"} ask when it's worth it.` : "Start something below, or enjoy the quiet."}</p>`);
  }
  // the card you were on is gone (its ask decided, nothing next), or you put one off or brought one back: focus is
  // the next move's, its card if there is one, else its place, which says what's left (never the page)
  if (S.homeFocusNext || (nextHad && !nb.contains(document.activeElement))) {
    S.homeFocusNext = false;
    const nc = nb.querySelector(".next");
    if (nc) nc.focus({ preventScroll: true }); else { nb.tabIndex = -1; nb.focus({ preventScroll: true }); }
  }
  landed(nb);

  // then… at most two more
  let then = "";
  if (P0.then.length) {
    then = `<section class="then" aria-labelledby="then-h"><h2 class="hm-lbl" id="then-h">Then</h2><ol>` +
      P0.then.map((n) => `<li><button type="button" class="then-i r-${n.risk}" data-fid="then-${esc(n.key)}" data-decide="${esc(n.key)}">` +
        `<span class="eff e-${n.effort}">${dial(n.effort)}<b>${EFFORT[n.effort].label}</b></span>` +
        `<span class="ti-t">${askTitle(n)}</span>` +
        // where it's asked always shows (a destructive one too): its project, or the project's coordinator
        `<span class="ti-p">${n.risk === "destructive" ? `<span class="risk r-destructive">Destructive</span>` : n.group === "stopped" ? `<span class="risk r-stopped">Stopped</span>` : ""}<span class="ti-w">${esc(PROJ(n.t.project))}${n.t.asker ? " coordinator" : ""}</span></span>${ICON.right}</button></li>`).join("") + `</ol>`;
    const foot = [];
    if (P0.more.length) foot.push(`<button type="button" class="hm-quiet" data-fid="more" data-open-all>+${P0.more.length} more</button>`);
    if (P0.glances.length >= 2) foot.push(`<button type="button" class="hm-quiet is-glance" data-fid="glances" data-glances>${dial("glance")}Clear ${P0.glances.length} glances together</button>`);
    if (P0.later.length) foot.push(`<button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}${P0.later.length} later today <span>bring back</span></button>`);
    if (foot.length) then += `<div class="then-foot">${foot.join("")}</div>`;
    then += `</section>`;
  } else if (P0.later.length) then = `<div class="then-foot solo"><button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}${P0.later.length} later today <span>bring back</span></button></div>`;
  patch($("#hm-then"), then);
  landed($("#hm-then"));
  // since you were away: one quiet line per project that moved (the 2026-11-04 card stays removed), then made
  patch($("#hm-since"), REC.homeSinceLines(needs));
  REC.homeMade($("#hm-made"));

  endRender(P0, working);
  SV.homeOrder($("#hm-body")); // the shape's order for Home (xo:home/*)
}

/** The last line: Handled (with what can wait). Its height never jumps. */
function endRender(P0, working) {
  const end = $("#hm-end");
  if (!end._built) {
    end.innerHTML = `<section class="handled" id="handled" aria-label="Handled"><div class="hd-row0"><div id="hd-head"></div></div><div class="hd-b" id="hd-b" hidden><div class="hd-in" id="hd-in"></div></div></section>`;
    end._built = true;
  }
  const w = working.length, held = P0.held;
  const bits = [w ? `${low(w)} working` : "nothing running", held.length ? `${low(held.length)} can wait` : ""].filter(Boolean);
  patch($("#hd-head"), `<button type="button" class="hd" data-fid="hd" data-handled aria-expanded="${S.handledOpen}" aria-controls="hd-b"><span class="hd-ic">${ICON.check}</span><span class="hd-t"><b>Handled</b> · ${bits.join(" · ")}</span>${w || held.length ? ICON.chevron : ""}</button>`);
  landed(end, [...$("#hd-head .hd").children]); // its frame was already there: what's in it arrives
  if (S.handledOpen) patch($("#hd-in"), handledListHtml(P0, working));
}
function handledListHtml(P0, working) {
  const rows = working.slice().sort((a, b) => a.project.localeCompare(b.project)).map((t) => {
    const c = t.checklist, cur = c.items.find((i) => i.state === "doing");
    return `<li><button type="button" class="hd-r" data-go="t:${esc(t.id)}"><span class="hd-p">${esc(PROJ(t.project))}</span><span class="hd-tt">${threadMark(t, { lead: true })}${esc(t.title)}</span><span class="hd-now">${cur ? esc(cur.text) : ""}</span><span class="mini" aria-label="${c.done} of ${c.total}"><i style="--p:${c.total ? c.done / c.total : 0}"></i></span></button></li>`;
  }).join("");
  const wait = P0.held.map((n) => `<li class="cw"><span class="cw-main"><span class="cw-t">${askTitle(n)}</span><span class="cw-why">${esc(PROJ(n.t.project))} · ${esc(n.heldWhy)}</span></span><button type="button" class="cw-in" data-bring-in="${esc(n.key)}">Bring in</button></li>`).join("");
  return (rows ? `<ul class="hd-ul">${rows}</ul>` : "") + (wait ? `<h3 class="hd-k">Can wait</h3><ul class="cw-ul">${wait}</ul>` : "");
}

/**
 * Decide straight from the Home card (Glance asks). The card stamps, then the next rises; focus lands on the new
 * card. Like a decision card, an ask can't be decided in its first 300 ms on screen: a click or key meant for the
 * one before can't land on it (Astra DEC-HOME-READ).
 */
async function nextDecide(choice, note) {
  const card = $("#hm-next .next");
  if (!card || card._busy) return;
  const key = card.dataset.key;
  const seen = NEXT_SEEN.get(key);
  if (seen == null || performance.now() - seen < Kit.READ_MS) { if (card.classList.contains("r-notable")) announce("A beat to read it first."); return; }
  card._busy = true;
  card.focus({ preventScroll: true });
  if (!D.decideNow(key, choice, note)) { card._busy = false; return; }
  if (!RM.matches) { card.classList.add(choice === "deny" ? "st-back" : "st-allow"); await wait(choice === "deny" ? 260 : 300); }
  S.pin = null;
  schedule();
  requestAnimationFrame(() => requestAnimationFrame(() => { const nc = $("#hm-next .next"); if (nc && S.view === "home" && !D.isOpen()) nc.focus({ preventScroll: true }); }));
}

function setHandled(open) {
  S.handledOpen = open;
  if (open) patch($("#hd-in"), handledListHtml(homeParts(), world.state.threads.filter(isBusy)));
  $("[data-handled]")?.setAttribute("aria-expanded", String(open));
  expand($("#handled"), $("#hd-b"), open);
}
// ── conversations ───────────────────────────────────────────────────────────
/** The chat behind a conversation: "ws" → workspace, "p:x" → x (threads use their project). */
const chatOf = (conv) => (conv === "ws" || conv === "home" ? "workspace" : conv.startsWith("p:") ? conv.slice(2) : convThread(conv)?.project || null);
const convOfChat = (chat) => (chat === "workspace" ? "ws" : "p:" + chat);
/** What a project's, the Workspace's or a plain chat's own conversation asks of you (its host: no thread). */
function convHost(v) {
  const hosts = world.state.hosts || [];
  if (v.startsWith("c:")) return hosts.find((h) => h.id === `session:${v.slice(2)}`) || null;
  const chat = v === "ws" ? world.project("workspace")?.chatId : v.startsWith("p:") ? world.project(v.slice(2))?.chatId : null;
  return chat ? hosts.find((h) => h.id === `chat:${chat}`) || null : null;
}

/** The real timeline (workspace or project) or the thread's own messages, with its root first. */
function messagesOf(conv) {
  const out = [];
  const t = convThread(conv);
  const chat = chatOf(conv);
  const st = world.state;
  const h = chat ? st.hist[chat] : null;
  let rows;
  if (t) {
    const root = (st.timeline[t.project] || []).find((r) => r.id === t.id) || st.found?.[t.project]?.get(t.id);
    rows = [...(root ? [uiMsg(root)] : []), ...t.messages];
  } else rows = (st.timeline[chat] || []).map(uiMsg);
  // optimistic rows whose server copy arrived first (the stream can beat the POST): the bubble stays, once
  const locals = S.local[conv] || [];
  for (const [lid, sid] of echoes(locals, rows, new Set(S.alias.keys()))) {
    S.alias.set(sid, lid);
    const m = locals.find((x) => x.id === lid);
    m.merged = true; m.status = "sent";
  }
  // a thread draws nothing of its own until its first page is in. Its turns and notes are read alongside the
  // page and came sooner: drawn alone they sat under "No messages in this thread yet." for seconds, then the
  // messages landed among them and pushed what you were reading away (1-5k px on a long thread, at 1x)
  if (t && !t.loaded) {
    const err = st.threadHist?.[t.id]?.error;
    out.push({ key: "note", at: -Infinity, who: "note", ...(err ? { text: `Couldn't load this thread: ${err}` } : { load: "Loading the thread" }) });
    out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
    return out;
  }
  if (!t && h) {
    if (h.error && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", text: `Couldn't load this conversation: ${h.error} Retrying.` });
    else if (h.loading && !rows.length) out.push({ key: "note", at: -Infinity, who: "note", load: "Loading the conversation" });
    else if (rows.length || h.loading) out.push({ key: "hist", at: -Infinity, who: "hist", h });
  }
  // a thread read in pages: the same line at its top (older pages on their way, or its beginning once a
  // thread that needed more than one page has been read to it)
  const th = t ? st.threadHist && st.threadHist[t.id] : null;
  if (th && th.loaded && rows.length && (!th.all || th.paged)) out.push({ key: "hist", at: -Infinity, who: "hist", h: { loading: !!th.older, all: !!th.all, olderError: th.olderError || null, before: th.before } });
  const ids = t ? [] : world.state.threads.filter((x) => x.project === chat).map((x) => x.id);
  const { on, alone } = threadAnchors(rows, ids);
  // the thread's running turn: your messages sent after it started wait for it to end
  const turn = t && t.busy && t.sessionId && st.turns ? st.turns.running(t.sessionId) : null;
  for (const m of rows) {
    const key = S.alias.get(m.id) || m.id;
    const base = { key, sid: m.id, at: m.at, seq: m.seq, text: m.text, sent: S.alias.has(m.id), files: m.files, chatId: m.chatId, reactions: m.reactions };
    if (m.who === "you" && !t && conv !== "ws" && m.fwd) {
      // a forwarded copy of your message: where it began, not just the copy before it (a forward back into the
      // chat you wrote it in is a copy of a copy, and must not read as you saying it again)
      const o = forwardOrigin(m.fwd, (id, cid) => {
        const p = cid && world.act.projectOf ? world.act.projectOf(cid) : null;
        return p ? (st.timeline[p] || []).find((r) => r.id === id) || st.found?.[p]?.get(id) || null : null;
      });
      if (!o.known && world.act.findRows) { const p = o.chatId && world.act.projectOf ? world.act.projectOf(o.chatId) : null; if (p) world.act.findRows(p, [o.id], m.seq); }
      // the same words you wrote earlier in this very chat, while the chain can't be read yet
      const mine = o.known ? (world.act.projectOf?.(o.chatId) === chat ? { id: o.id, text: o.row ? o.row.text : m.text } : null)
        : rows.filter((x) => x.who === "you" && !x.fwd && x.id !== m.id && x.at < m.at && x.text && x.text === m.text).pop();
      if (mine) { out.push({ key, sid: m.id, at: m.at, seq: m.seq, who: "system", back: { id: mine.id, text: String(mine.text ?? m.text), via: m.fwd.via } }); continue; }
      out.push({ ...base, who: "you", fwd: o.known ? { chatId: o.chatId, id: o.id, via: m.fwd.via } : m.fwd, queued: waitsForTurn(m, turn) });
      if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
    } else if (m.who === "you") {
      out.push({ ...base, who: "you", fwd: conv !== "ws" && m.fwd ? m.fwd : null, routed: conv === "ws" ? st.routed[m.id] || null : null, queued: waitsForTurn(m, turn) });
      if (alone.has(m.id)) out.push({ key: `${m.id}:card`, at: m.at, who: "card", thread: m.id });
    } else if (m.who === "system") out.push({ ...base, who: "system", passedOn: m.passedOn, continuedIn: m.continuedIn, continuedFrom: m.continuedFrom });
    else if (t && m.who === "agent" && /^✓\s/.test(m.text)) out.push({ key, at: m.at, who: "event", text: m.text.replace(/^✓\s*/, ""), tone: "ok" });
    else out.push({ ...base, who: m.who === "coord" ? "coord" : "agent", fwd: conv !== "ws" && m.fwd ? m.fwd : null, threads: on.get(m.id) || null });
  }
  if (conv.startsWith("p:")) {
    const pid = conv.slice(2);
    // These lines are dated by when they happened, but they come with the thread list, not the pages of the
    // conversation. One older than the history loaded so far would sit above all of it, and older pages
    // would land beneath it: the first thing you reach scrolling up never moves, so nothing keeps your place
    // and each landing page pushed what you read down by its height (5,000-8,000 px at 4x CPU). So a line is
    // drawn once the history reaches its time (all of them when the conversation is read to its beginning).
    const since = h && !h.all ? rows.reduce((a, m) => (Number.isFinite(m.at) && m.at < a ? m.at : a), Infinity) : -Infinity;
    const inView = (at) => !(at < since);
    for (const x of threadsOf(pid)) {
      if (!inView(x.lastAt)) continue;
      if (x.state === "done") out.push({ key: `${x.id}:done`, at: x.lastAt, who: "event", text: `${x.title} finished`, tone: "ok" });
      if (x.state === "failed") out.push({ key: `${x.id}:failed`, at: x.lastAt, who: "event", text: `${x.title} stopped`, tone: "stop" });
    }
    for (const d of D.decisions().filter((d) => d.project === pid && inView(d.at))) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `${d.verb} · ${d.said || d.label}`, tone: d.choice === "deny" ? "back" : "ok" });
    for (const d of D.notSent().filter((d) => d.project === pid && inView(d.at))) out.push({ key: `dec:${d.id}`, at: d.at, who: "event", text: `Not sent · ${d.said || d.label} · ${d.why}`, tone: "sys" });
  }
  // what its coordinator did to its turn (F6): one row each, in order. An interrupt or a stop also left XO's
  // own note on the thread; that note becomes the row, so nothing is said twice.
  if (t) for (const c of st.controls[t.id] || []) {
    const at = Date.parse(c.at) || 0;
    const note = c.action !== "steer" ? out.find((x) => x.who === "system" && !x.ctl && !x.continuedIn && !x.continuedFrom && !x.passedOn && /interrupt|stop/i.test(x.text || "") && Math.abs((x.at || 0) - at) < 15000) : null;
    if (note) { note.who = "control"; note.ctl = c; continue; }
    out.push({ key: `ctl:${c.seq ?? at}`, at, seq: c.seq, who: "control", ctl: c });
  }
  // a usage limit this thread waits on (F5): the same card as in Needs you, small, at the end
  if (t) for (const it of t.limits || []) out.push({ key: `lim:${it.id}`, at: Date.now(), who: "limit", item: it });
  // a move the thread row knows but whose note isn't in what we hold: its banner anyway (F4)
  if (t && t.movedFrom && !rows.some((m) => m.continuedFrom)) out.push({ key: `mvfrom:${t.id}`, at: t.createdAt - 1, who: "system", text: "", continuedFrom: t.movedFrom.from });
  if (t && t.movedTo && t.movedTo.to && !rows.some((m) => m.continuedIn)) out.push({ key: `mvto:${t.id}`, at: Date.parse(t.movedTo.at) || t.lastAt, who: "system", text: "", continuedIn: t.movedTo.to });
  // your messages relayed into this thread by its coordinator (if1 #7): the relay hop names them, and they
  // stay on the project's timeline (storm doesn't copy them), so they're shown here in place, whatever the
  // hops setting, marked as passed on, linking back to where you wrote them
  if (t && st.hops) {
    const { shown, missing } = relayedInto(t, st.hops.values(), st.timeline[t.project] || [], new Set(rows.map((m) => m.id)), st.found?.[t.project]);
    // each under its true author: yours as yours (placed where the hop delivered it, its seq and time, not where you wrote
    // it: written in the project's chat at 12:15 and passed on at 12:18, it sits below what you wrote here at 12:16;
    // its own time stays in `wrote`, for its tooltip), an agent's cited message as that agent's (a coordinator by its
    // name) at its own place, so a proposal stays above the "yes" that travelled with it, XO's as XO's
    const who = (r) => (r === "workspace-coordinator" ? "Workspace coordinator" : r === "project-coordinator" ? `${PROJ(t.project)} coordinator` : null);
    for (const m of shown) {
      if (m.who === "you") out.push({ key: `relay:${m.id}`, at: m.hop.at || m.at, seq: m.hop.seq ?? m.seq, who: "you", text: m.text, files: m.files, chatId: m.chatId, wrote: m.at, relay: { project: t.project, id: m.id, fwd: m.fwd, at: m.hop.at || 0 } });
      else out.push({ key: `relay:${m.id}`, at: m.at, seq: m.seq, who: m.who, text: m.text, files: m.files, chatId: m.chatId, ...(who(m.role) ? { name: who(m.role), role: "passed on", coord: true } : {}) });
    }
    if (world.act.findRows) for (const x of missing) world.act.findRows(t.project, x.ids, x.seq);
  }
  // what the coordinators and this thread wrote each other: storm keeps it as hops (their note), never
  // as messages, so it's shown here in place, whatever the hops setting
  const noted = new Set();
  if (t && st.hops) {
    for (const n of hopNotes(t, st.hops.values())) {
      noted.add(n.id);
      if (n.dir === "down") out.push({ key: `hopn:${n.id}`, at: n.at, seq: n.seq, who: "coord", text: n.text, name: n.from === "workspace" ? "Workspace coordinator" : `${PROJ(t.project)} coordinator`, role: n.kind, cause: n.cause });
      else out.push({ key: `hopn:${n.id}`, at: n.at, seq: n.seq, who: "asked", text: n.text, hop: n.id });
    }
    // a steer delivers the coordinator's next note (the hop stored right after it): the line says what happened, the note what it said
    for (const c of out.filter((x) => x.who === "control" && x.ctl.action === "steer" && x.seq != null).sort((a, b) => a.seq - b.seq)) {
      const note = out.filter((x) => x.who === "coord" && !x.lead && x.key.startsWith("hopn:") && x.seq > c.seq && x.at - c.at >= 0 && x.at - c.at < 10000).sort((a, b) => a.seq - b.seq)[0];
      if (note) note.lead = c.key;
    }
  }
  // how messages travelled to and from this thread (11 §16): hidden by default, shown by choice
  if (t && S.showHops && st.hops) {
    for (const hp of st.hops.values()) {
      if (hp.thread_ts !== t.id || noted.has(hp.id)) continue;
      const text = hopLine(hp, PROJ(t.project));
      if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
    }
  }
  // a thread's work: its session's turns, in place between its messages (storm's blocks). A turn is split
  // where a message or a coordinator's note came during it (turnview.js turnSegments): what it did
  // before sits above that message, what it did after sits below, each stretch where it happened, so the
  // running stretch grows under the latest message and nothing moves when the turn ends. The last stretch
  // keeps the turn's own key (turn:<id>), so a running turn's line (and a layer's live bubble on it) is the
  // same element all the way through; an earlier stretch is turn:<id>#<k>.
  if (t && t.sessionId && st.turns) {
    const says = rows.filter((m) => m.seq != null && m.id !== t.id).map((m) => ({ seq: m.seq, at: m.at, who: m.who }))
      .concat(out.filter((x) => x.seq != null && /^(hopn|relay|ctl|hop):/.test(x.key)).map((x) => ({ seq: x.seq, at: x.at, who: x.who })));
    // what the agent's messages carry: a turn's shared_files block doesn't draw them a second time
    const carried = rows.filter((m) => m.who !== "you").flatMap((m) => m.files || []);
    // a running turn's still-empty last stretch is "now": after everything held
    const tail = says.reduce((a, m) => (m.seq > a ? m.seq : a), 0) + 0.5;
    for (const tu of st.turns.list((x) => x.session === t.sessionId)) {
      const blocks = st.turns.blocksOf(tu);
      const said = says.some((q) => q.who === "agent" && q.seq >= (tu.seq ?? Infinity) && q.seq <= (tu.lastSeq || Infinity));
      for (const sg of turnSegments(tu, blocks, says)) {
        const turn = segmentTurn(tu, sg);
        const seq = tu.status === "running" && sg.last && sg.k > 0 && !sg.blocks.length ? Math.max(sg.seq, tail) : sg.seq;
        out.push({ key: sg.last ? `turn:${tu.id}` : `turn:${tu.id}#${sg.k}`, at: sg.from ?? (Date.parse(tu.at) || Date.now()), seq, who: "turn", turn, blocks: sg.blocks, hideAnswer: said, carried, working: sg.k > 0 });
      }
    }
  }
  // the Workspace's and a project's own hops, by the same choice: what a coordinator did on its own, and
  // work handed on to another project (its forward and the answer back)
  if (!t && chat && S.showHops && st.hops) {
    const cid = world.act.chatId?.(chat);
    // its own, and a forward into another project that one of its own asks caused
    const mine = (hp) => hp.chat_id === cid || (hp.kind === "forward" && st.hops.get(hp.cause)?.chat_id === cid);
    for (const hp of cid ? st.hops.values() : []) {
      if (hp.thread_ts != null || !mine(hp)) continue;
      const text = hopLine(hp, PROJ(chat), hp.kind === "forward" ? PROJ(world.act.projectOf?.(hp.chat_id) || "") : null);
      if (text) out.push({ key: `hop:${hp.id}`, at: Date.parse(hp.at || hp.created_at) || 0, seq: hp.seq ?? null, who: "system", text });
    }
  }
  // the coordinator's turn for your message failed: say so where you'll look (GitHub #30)
  const fail = !t && chat ? st.failed && st.failed[chat] : null;
  if (fail) out.push({ key: `fail:${fail.id}`, at: fail.at, who: "event", tone: "stop", text: `The coordinator couldn't answer: ${fail.error}` });
  // empty means nobody has said anything yet: XO's own lines here (a new project's "cloned from …", a record
  // line) are no conversation, so they don't stand in for one (the owner, 13 Nov 17:40Z: a cloned project
  // opened on its one "cloned" line, without the starts)
  if (!rows.length && !locals.some((m) => m.who === "you") && !(h && (h.loading || h.error))) {
    // a project's empty chat opens on what its coordinator can start for you (startHtml), after XO's own lines
    out.push(t || conv === "ws" ? { key: "empty", at: -Infinity, who: "note", text: t ? "No messages in this thread yet." : "No messages yet. Ask the coordinator anything below." } : { key: "empty", at: Infinity, who: "start", pid: convProject(conv) });
  }
  out.push(...locals.filter((m) => !m.merged).map((m) => ({ ...m, key: m.id })));
  // storm's seq orders what the server stored; the rest (your unsent rows, notes, events) is
  // merged in by time. Two sorted lists and one stable merge: a total order, so nothing jumps.
  // a paged thread shows what its pages hold: anything older (its root, a note, a turn that ended before
  // them) waits for its page, so it never shows cut off from the messages around it
  const floor = t ? pageFloor(th, t.messages) : null;
  const floorAt = floor == null ? null : t.messages.find((m) => m.seq === floor)?.at ?? null;
  const shown = floor == null ? out : out.filter((m) => inPage(m, floor, floorAt));
  const stored = shown.filter((m) => m.seq != null).sort((a, b) => a.seq - b.seq);
  const rest = shown.filter((m) => m.seq == null).sort((a, b) => a.at - b.at);
  const merged = [];
  let i = 0;
  for (const m of stored) {
    while (i < rest.length && rest[i].at < m.at) merged.push(rest[i++]);
    merged.push(m);
  }
  while (i < rest.length) merged.push(rest[i++]);
  return merged;
}

/** A message's words. One that holds a table is the wide kind of bubble: the whole text column, so a
 *  table gets the room it needs (QA #5; a prose bubble stops at 560 px, 88 % of the column). */
function proseHtml(text) {
  const html = renderMarkdown(text);
  return `<div class="prose${html.includes('<div class="md-table') ? " has-table" : ""}">${html}</div>`;
}
function threadCardHtml(tid, needs) {
  const t = world.thread(tid);
  if (!t) return "";
  const c = t.checklist;
  const n = needs.find((x) => x.t.id === t.id && x.admitted);
  const heldN = !n ? needs.find((x) => x.t.id === t.id && x.held) : null;
  const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
  const segs = c.items.map((i) => `<i class="sg s-${i.state}"></i>`).join("");
  const st = n ? `Needs you · ${EFFORT[n.effort].time}` : isBusy(t) ? `Working${c.total ? ` · ${c.done} of ${c.total}` : ""}` : t.state === "done" ? `Done${c.total ? ` · ${c.total} of ${c.total}` : ""}` : wordOf(t);
  const now = n ? `${ICON.needs}${askTitle(n)}` : isBusy(t) && cur ? `${ICON.doing}${esc(cur.text)}` : isHeld(t) ? esc(heldWords(t.held)) : t.stop ? esc(stopWords(t.stop)) : t.state === "failed" ? esc(String(t.happened || "").replace(/^Stopped:\s*/i, "")) : t.state === "done" ? esc(t.happened || "Finished.") : "";
  // a finished thread offers its real next step: the newest file it made, one click away (no file, no offer)
  const made = !n && t.state === "done" && REC.latestOf ? REC.latestOf(t.id, t.project) : null;
  return `<div class="tcard st-${n ? "needs" : stOf(t)}${made ? " has-next" : ""}">` +
    `<button type="button" class="tc-open" data-go="t:${esc(t.id)}" aria-label="Open thread: ${esc(t.title)}, ${esc(st)}">` +
    `<span class="tc-top">${stateMark(n ? "needs_reply" : glyphOf(t))}<b>${esc(t.title)}</b><span class="tc-st">${esc(st)}</span></span>` +
    `<span class="tc-segs${segs ? "" : " is-empty"}" aria-hidden="true">${segs}</span>` +
    (now ? `<span class="tc-now">${now}</span>` : "") +
    `<span class="tc-foot">${threadMark(t, { withName: true })}${t.branch && SHAPE.on("xo:thread/branch") ? `<code>${esc(t.branch)}</code>` : `<span>${noun("thread")}</span>`}${heldN ? `<span class="tc-cw">a small ask can wait</span>` : ""}<span>${short(t.lastAt) === "now" ? "just now" : short(t.lastAt) + " ago"}</span><span class="tc-go">Open ${ICON.arrow}</span></span></button>` +
    (n ? `<button type="button" class="tc-dec" data-decide="${esc(n.key)}">Decide</button>` : "") +
    (made ? `<button type="button" class="tc-next" data-made-file="${esc(made.key)}" title="${esc(made.path)}">${ICON.doc}<span>Open ${esc(made.title || made.name)}</span></button>` : "") + `</div>`;
}

/** Under your message that waits for the agent's turn to end: what happens to it, and Interrupt. */
function queuedMeta(conv, answered = false) {
  const t = convThread(conv);
  if (!t) return "";
  if (S.stops.has(t.sessionId) || world.act.sessionState(t.sessionId) === "stopping") return `<div class="meta"><i class="spin" aria-hidden="true"></i><span>Stopping its turn · it reads this next</span></div>`;
  // a runtime that steers took it into the running turn: nothing waits, nothing to interrupt (F7)
  if (sendWhileRunning(t) === "steered") return answered ? "" : `<div class="meta"><span>Sent into its current turn</span></div>`;
  const run = running(conv); // the conversation it's drawn in (the main chat, or a thread page in the panel)
  const n = workingRuns(t);
  const title = `Stop the agent's current turn${n ? ` and its ${n} sub-agent${n === 1 ? "" : "s"}` : ""} so it reads this now (Undo for 3 s)`;
  return `<div class="meta"><span>Waiting · the agent reads this when its current turn ends</span>` +
    (run && run.kind === "thread" ? `<button type="button" class="meta-btn" data-interrupt title="${esc(title)}">${ICON.bolt}Interrupt</button>` : "") + `</div>`;
}

function nameOf(conv, who) {
  if (who === "coord") return [conv === "ws" ? "Coordinator" : `${PROJ(convProject(conv))} coordinator`, ""];
  const t = convThread(conv);
  return [t ? `${PROJ(t.project)} agent` : "Agent", (SHAPE.on("xo:thread/branch") && t?.branch) || SHAPE.word("thread")];
}

/** F4: the two ends of a move, linked both ways. The reason is the server's, after its colon. */
function moveBannerHtml(m, here) {
  const reasonOf = (text) => { const i = String(text || "").indexOf(": "); return i > 0 ? text.slice(i + 2).trim() : ""; };
  const link = (ts, fallback) => { const o = world.thread(ts); return o ? `<button type="button" class="rt-go" data-go="t:${esc(ts)}" title="Open “${esc(o.title)}”"><b>${esc(o.title)}</b></button>` : `<b>${esc(fallback)}</b>`; };
  if (m.continuedIn) {
    const to = world.thread(m.continuedIn), mv = (here && here.movedTo) || {};
    const agent = (to && agentOf(to)) || mv.agent;
    const why = mv.reason || reasonOf(m.text);
    const frozen = !!(here && here.frozen);
    return `<div class="ev mv-ban"><span class="ev-ic">${ICON.runtime}</span><span class="ev-t">Continued in ${link(m.continuedIn, "a new thread")}${agent ? ` on ${esc(rtName(agent))}` : ""}${why ? `: ${esc(why)}` : ""}</span>` +
      (frozen ? `<button type="button" class="ev-undo" data-unfreeze="${esc(here.id)}" title="Its agent carries on here; the new thread keeps going too">Pick this thread back up</button>` : "") + `<time>${clock(m.at)}</time></div>`;
  }
  const from = world.thread(m.continuedFrom);
  const fromAgent = from ? agentOf(from) : null;
  return `<div class="ev mv-ban"><span class="ev-ic">${ICON.runtime}</span><span class="ev-t">Continued from ${link(m.continuedFrom, "an earlier thread")}${fromAgent ? ` (${esc(rtName(fromAgent))})` : ""}${reasonOf(m.text) ? `: ${esc(reasonOf(m.text))}` : ""}</span><time>${clock(m.at)}</time></div>`;
}
/**
 * Older messages loading: three quiet rows shaped like the conversation's own (the agent's words, your
 * bubble, the agent again), standing where the page will land. Their own classes, never .m: they are no
 * one's message (a layer that decorates messages leaves them alone). They breathe only while on screen,
 * and not at all with reduced motion (css/app.css .hist-skel).
 */
const HS_THEM = (n) => `<div class="hs-them" aria-hidden="true"><i class="hs-av"></i><div class="hs-b"><i class="hs-bar hs-name"></i>${"<i class=\"hs-bar\"></i>".repeat(n)}</div></div>`;
const HIST_SKEL = `<div class="hist-skel" role="status"><span class="sr-only">Loading earlier messages</span>${HS_THEM(2)}` +
  `<div class="hs-you" aria-hidden="true"><i class="hs-bub"><i class="hs-bar"></i></i></div>${HS_THEM(1)}</div>`;
/** Has anyone answered after your message? A message from the coordinator or an agent, or a finished turn that
    said something (a running turn, or one that only used tools, hasn't answered yet). Then its receipt is done. */
const answeredAfter = (list, m) => {
  const i = list.indexOf(m);
  return i >= 0 && list.slice(i + 1).some((x) => x.who === "coord" || x.who === "agent" ||
    (x.who === "turn" && x.turn && x.turn.status !== "running" && Array.from(x.blocks || []).some((b) => b && (b.type === "answer" || b.type === "text") && String(b.text || "").trim())));
};
/** The thread a hop handed your message to, by the hop's own message ids; null when no hop names it. */
function passedTo(m) {
  if (!world.state.hops) return null;
  // the message as the server knows it: a row carries its server id (sid); a bubble you sent here keeps its
  // local id (id, key), and S.alias maps the server's id to it once the row is back
  const ids = new Set([m.sid, m.id, m.key].filter(Boolean));
  for (const [sid, lid] of S.alias) if (ids.has(lid)) ids.add(sid);
  if (!ids.size) return null;
  for (const h of world.state.hops.values()) {
    if ((h.kind === "relay" || h.kind === "brief") && h.to_role === "thread" && h.thread_ts && (h.message_ids || []).some((x) => ids.has(x))) return world.thread(h.thread_ts)?.title || "a thread";
  }
  return null;
}
/** An empty project chat: what its coordinator really does when asked, as the start of a message. A press
 *  puts that start in the composer for you to finish; nothing is sent for you. Each is something XO does
 *  for a project: a thread with its own agent and branch, a fix, a read of the project's own files, and
 *  a job on a schedule (the owner allows it first). Typing hides them (css: .st-list). */
const STARTS = [
  { ic: "plus", label: "Make something new", say: () => `Start a ${SHAPE.word("thread")} to make ` },
  { ic: "edit", label: "Fix or change something", say: () => "Fix " },
  { ic: "search", label: "Explain how this project works", say: () => "Read through this project and explain how it works." },
  { ic: "clock", label: "Do something on a schedule", say: () => "Every weekday at 9:00, " },
];
function startHtml(pid) {
  return `<div class="m-start"><h2 class="st-h">What should get done in ${esc(PROJ(pid))}?</h2><ul class="st-list">${STARTS.map((o, i) =>
    `<li><button type="button" class="st-o" data-start="${i}"><span class="st-ic" aria-hidden="true">${ICON[o.ic]}</span>${esc(o.label)}</button></li>`).join("")}</ul></div>`;
}
function startDraft(i) {
  const o = STARTS[i];
  if (!o || say.value.trim()) return;
  say.value = o.say();
  growSay(); saveDraft(); updateComposer(); say.focus();
  say.setSelectionRange(say.value.length, say.value.length);
}

function msgItems(conv, needs) {
  drawing = conv;
  try { return msgItemsOf(conv, needs); } finally { drawing = null; }
}
function msgItemsOf(conv, needs) {
  if (CH.isChats(conv)) return CH.items(conv);
  if (conv.startsWith("t:") && !convThread(conv)) {
    // a link to a thread that isn't here (removed, or from before a reset): said plainly, never an empty page
    const known = projects().length > 0;
    return [{ key: "gone", html: known
      ? `<div class="calm"><div class="calm-mark">${ICON.thread}</div><h2>This thread isn't here.</h2><p>It may have been removed, or the link is older than this Space. Everything else is where you left it.</p><div class="calm-act"><button type="button" class="btn" data-go="home">Go to Home</button></div></div>`
      : `<div class="calm"><div class="calm-mark">${ICON.thread}</div><h2>Looking for this thread…</h2></div>` }];
  }
  const list = messagesOf(conv);
  const items = [];
  let day = "", prev = null, above = null;
  // who spoke last: a thread names a speaker only when it changes (its agent's turn counts as the agent); a
  // project's or the Workspace's chat names no one
  const named = !!convThread(conv);
  let spoke = null;
  const lastYou = [...list].reverse().find((m) => m.who === "you");
  // your newest message the agent hasn't read yet: Interrupt stops the turn so it reads it next
  const lastQueued = [...list].reverse().find((m) => m.queued);
  // a changed file's chip carries its +/− counts, and reads as chosen while the panel shows its diff
  // the chosen file: the one beside the chat when a file is open there (the middle), else the panel's
  const chosen = STAGE.chosen(conv);
  const changed = (target) => { const c = CHG.forTarget(conv, target); return c ? { additions: c.file.additions, deletions: c.file.deletions, binary: c.file.binary, on: c.path === chosen } : null; };
  for (const m of list) {
    const d = Number.isFinite(m.at) ? dayOf(m.at) : day;
    if (d !== day) { items.push({ key: "day|" + d, html: `<div class="day" role="separator"><span>${esc(d)}</span></div>` }); day = d; prev = null; above = null; spoke = null; }
    const cont = prev && prev.who === m.who && prev.name === m.name && m.at - prev.at < 5 * 60000 && (prev.fwd?.chatId || null) === (m.fwd?.chatId || null) && (m.who === "you" || m.who === "coord" || m.who === "agent");
    let html = "";
    if (m.who === "you") {
      spoke = "you";
      let meta = "";
      if (m.status === "sending") meta = `<div class="meta is-sending"><i class="spin" aria-hidden="true"></i>Sending</div>`;
      else if (m.status === "failed") meta = `<div class="meta is-err"><span${m.err ? ` title="${esc(m.err.text)}"` : ""}>${m.err ? esc(m.err.title) : "Not sent"}</span><button type="button" class="meta-btn" data-retry="${esc(m.id)}">${ICON.retry}Retry</button><button type="button" class="meta-btn" data-edit="${esc(m.id)}">${ICON.edit}Edit</button></div>`;
      else if (m === lastQueued) meta = queuedMeta(conv, answeredAfter(list, m));
      else if (m === lastYou && (m.status === "sent" || m.sent) && !answeredAfter(list, m)) {
        // a receipt that follows the message only as far as the record proves: received by XO, then handed to a
        // thread (a relay or brief hop that names this message); it goes once an answer is on screen
        const to = passedTo(m);
        meta = `<div class="meta"><time>${clock(m.at)}</time><span class="sent">${to ? `Passed to <b>${esc(to)}</b>` : "Received by XO"} ${ICON.check}</span></div>`;
      }
      let route = "";
      if (m.waiting) route = `<div class="route-row"><i class="dash" aria-hidden="true"></i>Sent to <b>${esc(m.target === "workspace" ? "the coordinator" : PROJ(m.target))}</b> · waiting for a thread</div>`;
      else if (m.relay) {
        // passed on into this thread: say from where, and go back there (to the message itself)
        const r = m.relay, P = PROJ(r.project);
        const when = r.at ? ` at ${clock(r.at)}` : "";
        route = r.fwd
          ? `<div class="route-row">${ICON.arrow}<span>You, in the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(r.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button> · passed on${when} by ${esc(P)}'s coordinator</span></div>`
          : `<div class="route-row">${ICON.arrow}<span>You, in <button type="button" class="rt-go" data-go="p:${esc(r.project)}" data-go-msg="${esc(r.id)}" title="Where you wrote it"><b>${esc(P)}'s chat</b></button> · passed on${when} by the coordinator</span></div>`;
      }
      else if (m.fwd) {
        // work one project handed another: "from sys via the Workspace", back to where you wrote it
        const src = fwdSource(m.fwd);
        route = src
          ? `<div class="route-row">${ICON.arrow}<span>From <button type="button" class="rt-go" data-go="p:${esc(src)}" data-go-msg="${esc(m.fwd.id)}" title="Where you wrote it"><b>${esc(PROJ(src))}</b></button> via the Workspace</span></div>`
          : `<div class="route-row">${ICON.arrow}<span>Forwarded by the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(m.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button></span></div>`;
      }
      else if (m.routed && m.routed.length) route = `<div class="route-row">${ICON.arrow}<span>Routed to ${[...new Set(m.routed.map((r) => r.chat))].map((c) => `<button type="button" class="rt-go" data-go="p:${esc(c)}"><b>${esc(PROJ(c))}</b></button>`).join(", ")}</span></div>`;
      // your pictures sit above your words, right-aligned (js/media.js); other files as cards
      const files = m.files && m.files.length ? mediaHtml(m.files.map((f) => fromAttachment(f, { chat: m.chatId, by: "You", at: m.at })), { side: "you" }) : "";
      html = `<div class="m m-you${cont ? " cont" : ""}${m.relay ? " is-relay" : ""}${m.status === "failed" ? " is-failed" : ""}${m.status === "sending" ? " is-pending" : ""}">${files}${m.text ? `<div class="bubble" title="${esc(clock(m.wrote ?? m.at))}">${youText(m.text)}</div>` : ""}${reactionsHtml(m.reactions)}${meta}${route}</div>`;
    } else if (m.who === "coord" || m.who === "agent") {
      // a copy from another chat is that chat's speaker, named for it, and closed by a ruled line saying so
      const word = m.who === "coord" ? "coordinator" : "agent", src = m.fwd ? fwdSource(m.fwd) : null;
      const [name, role] = m.name ? [m.name, m.role || ""] : src ? [`${PROJ(src)} ${word}`, ""] : nameOf(conv, m.who);
      const copy = !m.fwd ? "" : `<div class="route-row is-copy">${ICON.arrow}<span>Copied from ${src
        ? `<button type="button" class="rt-go" data-go="p:${esc(src)}" data-go-msg="${esc(m.fwd.id)}" title="Where it was written"><b>${esc(PROJ(src))}</b></button>'s ${word}<span class="via"> · via the Workspace</span>`
        : `the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(m.fwd.id)}" title="Where it was written"><b>Workspace</b></button>`}</span></div>`;
      const av = m.who === "coord" ? `<div class="av">${XO}</div>` : `<div class="av av-t">${ICON.thread}</div>`;
      // the coordinator's violet (.m-coord) sets it apart only where it steps into a thread, beside the thread's own
      // agent, as bubbles always did; in its own chat it is the one speaking and stays neutral (the owner, 19 Nov 14:46Z)
      const tid = m.thread || m.threadId;
      const iq = m.iq ? `<span class="m-iq" title="${m.iq.src === "pinned" ? "Pinned for this conversation" : `Chosen by the ${esc(m.iq.src)}`}">${esc(m.iq.name)} ${m.iq.pips} · ${esc(m.iq.src)}</span>` : "";
      // what an agent shares on its message shows under its words, on its text column
      const media = m.files && m.files.length ? mediaHtml(m.files.map((f) => fromAttachment(f, { chat: m.chatId, by: name, at: m.at })), { side: "them" }) : "";
      // words right under the line that introduces them (the question they answer, the steer that delivered them) are one exchange: that line already says who
      const under = !!(above && ((m.cause && above.who === "asked" && above.hop === m.cause) || (m.lead && above.key === m.lead)));
      const anon = !named || spoke === name || under;
      spoke = name;
      if (under) items[items.length - 1].html = items[items.length - 1].html.replace(/^<div class="ev /, '<div class="ev is-lead ');
      html = `<div class="m m-them${(m.who === "coord" || m.coord) && convThread(conv) ? " m-coord" : ""}${cont ? " cont" : ""}${anon ? " m-anon" : ""}${under ? " m-under" : ""}">${cont ? `<div class="av av-gap"></div>` : av}<div class="mb">` +
        (cont ? "" : `<div class="mh"><b>${esc(name)}</b>${role ? `<span class="role">${esc(role)}</span>` : ""}<time>${clock(m.at)}</time>${iq}</div>`) +
        `${m.text ? proseHtml(m.text) : ""}${media}${reactionsHtml(m.reactions)}${copy}${tid ? threadCardHtml(tid, needs) : ""}${(m.threads || []).map((x) => threadCardHtml(x, needs)).join("")}</div></div>`;
    } else if (m.who === "turn") {
      const inner = turnHtml(m.turn, m.blocks, { open: S.tbOpen, hideAnswer: m.hideAnswer, carried: m.carried, route: (p) => fileRoute(p, conv), by: nameOf(conv, "agent")[0], working: m.working, changed });
      if (!inner) { prev = m; continue; }
      // is-folded: running with nothing pressed open and no step waiting on you (the working bubble shows)
      const live = m.turn.status === "running", unfolded = inner.includes('aria-expanded="true"') || /class="[^"]*\bis-waiting\b/.test(inner);
      // has-said: while it works it has already said something (words, files) that shows above its bubble
      const said = live && !unfolded && /class="turn[^"]*\bis-said\b/.test(inner);
      spoke = nameOf(conv, "agent")[0];
      html = `<div class="m m-them m-turn${live ? " is-live" : ""}${live && !unfolded ? " is-folded" : ""}${said ? " has-said" : ""}">${turnAv(m.turn, m.blocks)}<div class="mb">${inner}</div></div>`;
    } else if (m.who === "card") {
      html = `<div class="m m-them m-card"><div class="av av-gap"></div><div class="mb">${threadCardHtml(m.thread, needs)}</div></div>`;
    } else if (m.who === "system" && m.back) {
      // a copy of your own earlier message in this chat, handed back by a forward: a quote of it, never a second bubble
      const b = m.back, q = b.text.replace(/\s+/g, " ").trim(), via = (b.via || []).find((v) => v !== "workspace" && v !== "project" && world.project(v));
      html = `<div class="ev ev-sys ev-back"><span class="ev-ic">${ICON.arrow}</span><span class="ev-t">Your earlier message <button type="button" class="rt-go" data-go="p:${esc(convProject(conv))}" data-go-msg="${esc(b.id)}" title="Where you wrote it">“${esc(q.length > 40 ? q.slice(0, 39) + "…" : q)}”</button> came back${via ? ` via ${esc(PROJ(via))}` : ""}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "system" && m.passedOn) {
      // XO's line: this project's work went on to another project, through the Workspace (always shown)
      const p = m.passedOn;
      html = `<div class="ev ev-sys ev-pass"><span class="ev-ic">${ICON.arrow}</span><span class="ev-t">Passed to <button type="button" class="rt-go" data-go="p:${esc(p.project)}"${p.to ? ` data-go-msg="${esc(p.to)}"` : ""} title="Open ${esc(PROJ(p.project))}'s chat"><b>${esc(PROJ(p.project))}</b></button> through the Workspace</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "control") {
      const c = m.ctl;
      const who = c.by === "workspace-coordinator" ? "The workspace coordinator" : "The coordinator";
      const text = c.action === "steer" ? `${who} added to the running turn` : c.action === "interrupt" ? `${who} interrupted the turn` : `${who} stopped the thread${c.reason ? `: ${c.reason}` : ""}`;
      html = `<div class="ev ev-sys ev-ctl is-${esc(c.action)}"${c.reason && c.action !== "stop" ? ` title="${esc(c.reason)}"` : ""}><span class="ev-ic">${c.action === "steer" ? ICON.arrow : c.action === "interrupt" ? ICON.pause : ICON.close}</span><span class="ev-t">${esc(text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "limit") {
      const it = m.item, L = it.limit;
      const opts = (it.options || []).map((o) => `<button type="button" class="${o.decision === "move" ? "btn btn-pri" : "btn"}" data-limit="${esc(it.id)}" data-limit-d="${esc(o.decision)}"${S.limitBusy === it.id ? " disabled" : ""}>${esc(o.label)}</button>`).join("");
      html = `<div class="lim-ban" role="group" aria-labelledby="lim-h-${esc(it.id)}"><p class="lim-h" id="lim-h-${esc(it.id)}">${ICON.clock}<span>${esc(it.title)}${L.resetsAt && untilWords(L.resetsAt) ? ` <em>${esc(untilWords(L.resetsAt))}</em>` : ""}</span></p>` +
        (it.why ? `<p class="lim-why">${esc(it.why)}</p>` : "") + (S.limitErr && S.limitErr.id === it.id ? `<p class="rt-ferr" role="alert">${esc(S.limitErr.text)}</p>` : "") + `<div class="lim-acts">${opts}</div></div>`;
    } else if (m.who === "system" && (m.continuedIn || m.continuedFrom)) {
      html = moveBannerHtml(m, convThread(conv));
    } else if (m.who === "asked") {
      // the thread's own message to its coordinator: one quiet line, the whole text on a press
      const open = !!S.tbOpen[m.key];
      html = `<div class="ev ev-sys ev-asked${open ? " is-open" : ""}"><span class="ev-ic">${ICON.arrow}</span><button type="button" class="ev-t" data-tb="${esc(m.key)}" aria-expanded="${open}" title="${open ? "Fold" : "Show all of it"}">Asked the coordinator: ${esc(m.text)}</button><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "system") {
      html = `<div class="ev ev-sys" title="${esc(m.text)}"><span class="ev-ic">${ICON.router}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "note") {
      html = m.load ? `<div class="m-load" role="status"><i class="spin is-load" aria-hidden="true"></i><span class="sr-only">${esc(m.load)}</span></div>` : `<p class="m-note">${esc(m.text)}</p>`;
    } else if (m.who === "start") {
      html = startHtml(m.pid);
    } else if (m.who === "hist") {
      const h = m.h;
      // older messages on their way: the shapes of messages where they will land, never a spinner
      html = h.loading ? HIST_SKEL
        : `<div class="day hist" role="separator">${h.all ? `<span>${h.capped ? "Showing the latest 1,000 messages" : "Beginning of the conversation"}</span>` : h.olderError ? `<span>Couldn't load earlier messages</span><button type="button" class="hist-more" data-older>Try again</button>` : `<button type="button" class="hist-more" data-older>Earlier messages</button>`}</div>`;
    } else if (m.who === "event") {
      html = `<div class="ev ev-${m.tone || "ok"}"><span class="ev-ic">${m.tone === "back" ? ICON.rewind : m.tone === "stop" ? ICON.close : m.tone === "sys" ? ICON.pause : ICON.check}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
    } else if (m.who === "rec") {
      const canUndo = m.undo && Date.now() < m.until;
      html = `<div class="ev ev-rec${m.refused ? " is-refused" : ""}"><span class="ev-ic">${m.refused ? ICON.close : ICON.router}</span><span class="ev-t">${esc(m.text)}</span>${canUndo ? `<button type="button" class="ev-undo" data-rec-undo="${esc(m.id)}">Undo</button>` : ""}<time>${clock(m.at)}</time></div>`;
    }
    items.push({ key: m.key, html });
    prev = above = m;
  }
  return items;
}

// ── headers: Workspace, project (title + one sentence + the Now shelf), thread (+ checklist) ──
/** hub #28, thinned (design-research/12 §3): the Workspace is the conversation with your coordinator,
 *  so the top of its history only says what this place is. The counts are one line in the header; what
 *  needs you lives on Home, and the header's Next move opens it. Nothing here repeats Home. */
function wsHeadRender() {
  const box = $("#ws-head");
  if (S.view !== "ws") { box.hidden = true; return; }
  box.hidden = false;
  patch(box, `<div class="wsh"><div class="wsh-mark">${XO}</div><h2 class="wsh-h">Workspace</h2>` +
    `<p class="wsh-p">Your coordinator, across all ${projects().length} projects. Tell it what should get done; it routes the work. What needs you waits on <button type="button" class="wsh-home" data-go="home">Home</button>.</p></div>`);
}

/** The title bar's count line, set as type: each figure a shade brighter than its word, in
 *  tabular figures so a count that changes never shifts the line, and a quiet dot between; a narrow
 *  line breaks only at a dot, never inside "1 resolved". */
const counted = (n, word) => (n ? `<span class="pj-c"><span class="pj-k">${n}</span> ${word}</span>` : "");
const countLine = (bits) => bits.filter(Boolean).join(`<span class="pj-d" aria-hidden="true"> · </span>`);
/** A place's threads, counted once for the header and the panel (the owner, 19 Nov 14:50Z: the header said 35, the
 *  panel 73): every thread of the project, the Done ones too, which is the list the panel's Threads shows (the
 *  coordinator's own row isn't a thread and isn't counted); by state in the panel's four words. The header said
 *  35 because it counted only the unresolved (threadsOf); the panel counted every thread and the coordinator row. */
function threadCounts(pid, needs) {
  const c = { all: 0, needs: 0, working: 0, waiting: 0, done: 0 };
  for (const t of world.state.threads) if (t.project === pid) { c.all++; c[threadState(t, needs)]++; }
  return c;
}

/** The project header's Threads control (the owner, 19 Nov 14:16Z: the header must say the project has threads,
 *  legibly, apart from its title; 14:20Z: beside Deploy): "Threads" and how many, then what's at work as the working
 *  arc and its number, and what needs you as its mark and number. One 32 control among the header's actions; it
 *  opens the panel's Threads. Short of room (a phone), the word goes; the marks and numbers stay. */
function threadsCtl(n, by) {
  if (!n) return ""; // a project with no threads yet: its empty page says what to start
  const words = [`${n} ${n === 1 ? "thread" : "threads"}`, by.working && `${by.working} working`, by.needs && `${by.needs} ${by.needs === 1 ? "needs" : "need"} you`].filter(Boolean).join(", ");
  const live = (by.working ? `<span class="th-seg is-work">${stateMark("working")}<span class="pj-k">${by.working}</span></span>` : "") +
    (by.needs ? `<span class="th-seg is-need">${stateMark("needs_reply")}<span class="pj-k">${by.needs}</span></span>` : "");
  return `<button type="button" class="tw-act th-ctl" data-stage-open aria-controls="stage" title="${esc(words)}: open them in the panel" aria-label="${esc(words)}. Open them in the panel">` +
    `${ICON.threadOne}<span class="th-w">Threads</span><span class="th-n">${n}</span>${live}</button>`;
}

/** A chat whose own coordinator asks: "Needs you" leads its count line, and opens the card above the composer. */
function hostNeedHtml(v, needs) {
  const h = convHost(v);
  const n = h ? needs.find((x) => x.t.id === h.id && !x.later && (x.admitted || x.held)) : null;
  if (!n) return "";
  const k = h.asks.length;
  const who = h.asker ? "Coordinator" : h.title;
  return `<button type="button" class="pj-need" data-dock-open="${esc(n.key)}" title="Open the decision, above the composer">` +
    `${stateMark("needs_approval")}<span class="pj-nt">${esc(who)} needs you</span>${k > 1 ? ` <span class="pj-k">${k}</span>` : ""}</button>`;
}

const convName = (v, t) => (t ? t.title : v.startsWith("p:") ? PROJ(v.slice(2)) : v === "ws" ? "Workspace" : ($("#conv-title")?.textContent || "Conversation"));

function topRender(needs) {
  const v = S.view;
  const t = convThread(v);
  const top = $("#top");
  top.dataset.kind = t ? "thread" : "project"; // hub #28: the Workspace has a project's header, always shown
  // a thin state line along the thread's header: amber needs you, blue working, green done, red stopped
  top.dataset.state = !t ? "" : needs.some((n) => n.t.id === t.id && n.admitted) ? "need" : t.state === "failed" && !t.stop ? "stop" : isBusy(t) ? "busy" : t.state === "done" || t.state === "resolved" ? "done" : "";
  const back = $("#top-back");
  back.hidden = !t;
  if (CH.isChats(v)) {
    // Chats: the list, or one chat with its way back to the list
    top.dataset.kind = v === "chats" ? "project" : "thread";
    back.hidden = v === "chats";
    if (v !== "chats") { patch(back, `${ICON.back}<span>Chats</span>`); back.setAttribute("aria-label", "Back to Chats"); back.title = "Back (Esc)"; }
    patch($("#top-who"), CH.headHtml(v));
    patch($("#top-end"), STAGE.button(v));
    checklistRender(needs);
    return;
  }
  if (t) {
    const to = S.parent[v] || "p:" + t.project;
    const name = to === "home" ? "Home" : to === "ws" ? "Workspace" : PROJ(to.slice(2));
    patch(back, `${ICON.back}<span>${esc(name)}</span>`); // written when the name changes, not every render
    back.setAttribute("aria-label", `Back to ${name}`);
    back.title = "Back (Esc)";
  }
  let who, end = "";
  if (v === "ws") {
    // hub #28: a normal chat's header, like a project's: the counts in one line, what needs you one click away
    const P0 = homeParts(needs);
    const nd = P0.active.length;
    const asking = new Set(needs.map((n) => n.t.id));
    const working = world.state.threads.filter(isBusy).length;
    // held back by a gate (the usage limit…): "waiting", the word its badge and the Waiting filter use; neither working nor idle
    const waiting = world.state.threads.filter((x) => isHeld(x) && !asking.has(x.id)).length;
    const idle = world.state.threads.filter((x) => x.state === "working" && !isBusy(x) && !isHeld(x) && !asking.has(x.id)).length;
    const done = doneToday().length;
    const parts = [counted(working, "working"), counted(waiting, "waiting"), counted(P0.held.length, "can wait"), counted(idle, "idle"), counted(done, "finished today")].filter(Boolean);
    const need = hostNeedHtml(v, needs);
    const line = countLine([...(parts.length ? parts : ["All quiet"]), projects().length && `across ${counted(projects().length, projects().length === 1 ? "project" : "projects")}`]);
    // the counts go to Home; what the Workspace's own coordinator asks opens here, so the two are separate buttons
    who = `<span class="tw-ic tw-xo" aria-hidden="true">${XO}</span><span class="tw-t"><h1 id="conv-title">Workspace</h1>${need ? `<span class="pj-s has-need">${countLine([need, `<button type="button" class="pj-home" data-go="home" title="What needs you is on Home">${line}</button>`])}</span>` : `<button type="button" class="pj-s pj-home" data-go="home" title="What needs you is on Home">${line}</button>`}</span>`;
  } else if (v.startsWith("p:")) {
    const pid = v.slice(2);
    // the same count and words as the panel's Threads (threadCounts): every thread, Done folded there
    const by = threadCounts(pid, needs);
    const need = hostNeedHtml(v, needs);
    // the header says the project has threads (the owner, 19 Nov 14:20Z picked it beside Deploy): Threads and how
    // many, what's at work, what needs you; one control among the header's actions, apart from the title
    who = `<button type="button" class="pj-pick" data-pj-icon="${esc(pid)}" aria-haspopup="dialog" aria-expanded="${PICK.pid === pid}" title="Change ${esc(PROJ(pid))}'s icon" aria-label="Change ${esc(PROJ(pid))}'s icon"><span class="tw-ic" aria-hidden="true">${projectIcon(pid)}</span></button><span class="tw-t is-one"><h1 id="conv-title"${S.desc[pid] ? ` title="${esc(S.desc[pid])}"` : ""}>${esc(PROJ(pid))}</h1>${need}</span>`;
    S.hdrCtl = threadsCtl(by.all, by);
  } else if (t) {
    const ed = S.tEdit && S.tEdit.tid === t.id ? S.tEdit.field : null;
    // the field shows what was typed (kept through a refusal), and says it's waiting while it saves
    const edVal = ed ? S.tEdit.value : "", edBusy = ed && S.tEdit.busy ? ' aria-busy="true" readonly' : "";
    const title = ed === "title"
      ? `<input class="tw-in tw-in-t" id="tw-edit" data-tedit="title" maxlength="120" value="${esc(edVal)}" aria-label="Thread name"${edBusy}>`
      : `<h1 class="tw-h" id="conv-title">${esc(t.title)}</h1>`;
    const label = ed === "label"
      ? `<input class="tw-in tw-in-l" id="tw-edit" data-tedit="label" maxlength="32" value="${esc(edVal)}" placeholder="A short label" aria-label="Label"${edBusy}>`
      : t.label ? `<span class="tw-label" title="Label">${esc(t.label)}</span>` : "";
    const resolved = t.state === "resolved";
    const acts = world.act.storm ? `<span class="tw-acts"><button type="button" class="tw-act" data-key="tw-resolve" data-resolve="${esc(t.id)}" data-to="${resolved ? "open" : "resolve"}"${busyAttrs(`resolve:${t.id}`)} title="${resolved ? "Reopen it: its agent can pick it up again" : "Mark it resolved: nothing more is owed"}">${resolved ? ICON.retry : ICON.check}<span>${resolved ? "Reopen" : "Resolve"}</span></button>` +
      `<button type="button" class="tw-act tw-more" data-tmenu="${esc(t.id)}" aria-haspopup="menu" aria-expanded="${S.tMenu === t.id && S.tMenuIn !== "page"}" title="Everything this thread can do" aria-label="Thread actions">${ICON.more}</button>` +
      (S.tMenu === t.id && S.tMenuIn !== "page" ? threadMenuHtml(t) : "") + `</span>` : "";
    // a shell in its worktree is in the menu (and the shells dock); the header keeps Resolve and the panel
    const allActs = acts ? acts.replace(/<\/span>$/, `${LP.button(v, LW.isOpen)}${STAGE.button(v)}</span>`) : `<span class="tw-acts">${LP.button(v, LW.isOpen)}${STAGE.button(v)}</span>`;
    who = `${title}${label}<span class="badge st-${stOf(t)}">${stateMark(glyphOf(t))}${isHeld(t) ? heldBadge(t.held) : wordOf(t)}</span>${rtTag(t)}${allActs}`;
    // a field being edited is never replaced under the person's fingers (a frame may change the badge)
    if (ed && $("#tw-edit")) who = null;
  } else who = `<span class="tw-t"><h1 id="conv-title">Thread</h1></span>`;
  // in place (js/redraw.js): Resolve turning into Reopen, ⋯ opening its menu, the badge changing, all keep the
  // control you're on
  if (who != null && $("#top-who")._h !== who) { redraw($("#top-who"), who); $("#top-who")._h = who; }
  // in place too: Threads (the switcher's opener) is the same button when All opens and sets aria-expanded, so
  // closing All finds it to return to (Astra H30)
  const pv = v.startsWith("p:");
  const endHtml = t ? end : end + (pv ? S.hdrCtl + LP.button(v, LW.isOpen) : "") + STAGE.button(v);
  if ($("#top-end")._h !== endHtml) { redraw($("#top-end"), endHtml); $("#top-end")._h = endHtml; }
  LP.ensure(v);
  checklistRender(needs);
  tdelRender(t);
  REC.sinceLine(v.startsWith("p:") ? v.slice(2) : null, needs);
}


/** The checklist bar: shows the step in progress; a finished step flashes its tick, then moves on. */
function checklistRender(needs, th = $("#thead"), view = S.view, listId = "ck-list") {
  const t = convThread(view);
  if (!t) { th.hidden = true; th._h = ""; return; }
  const c = t.checklist;
  // no steps, no checklist: a thread without a plan has nothing to disclose and no step to count, so the head holds
  // only its runs (none: it hides). It painted a 0-of-0 toggle that opened onto nothing and said "All 0 steps done"
  // (the create-project/Launchpad grader on 70375ad, C045). The bar comes with the agent's first step.
  if (!c.total) {
    const all = runsStrip(t);
    if (th._h !== all) { redraw(th, all); th._h = all; }
    th.hidden = !all;
    return;
  }
  th.hidden = false;
  const open = !!S.ckOpen[t.id];
  const seen = S.ckSeen[t.id];
  if (seen != null && c.done > seen) {
    const doneStep = c.items[c.done - 1];
    S.ckFresh = { tid: t.id, text: doneStep ? doneStep.text : "Step done", until: Date.now() + 1500 };
    setTimeout(schedule, 1560);
  }
  S.ckSeen[t.id] = c.done;
  const fresh = S.ckFresh && S.ckFresh.tid === t.id && S.ckFresh.until > Date.now() ? S.ckFresh : null;
  const n = needs.find((x) => x.t.id === t.id);
  const cur = c.items.find((i) => i.state === "doing") || c.items.find((i) => i.state === "todo");
  let mode = "working", nowHtml;
  if (fresh) { mode = "fresh"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>${esc(fresh.text)}</span>`; }
  else if (n && WAITING(t.state)) { mode = "needs"; nowHtml = `<span class="ck-m is-amber">${ICON.needs}</span><span>Paused on you</span>`; }
  else if (t.stop) { mode = "stopped"; nowHtml = `<span class="ck-m">${ICON.stop}</span><span>${esc(stopWords(t.stop))}</span>`; }
  else if (t.state === "failed") { mode = "failed"; nowHtml = `<span class="ck-m is-red">${ICON.stop}</span><span>Stopped at “${esc(cur ? cur.text : "a step")}”</span>`; }
  else if (c.done >= c.total) { mode = "done"; nowHtml = `<span class="ck-m is-ok">${ICON.check}</span><span>All ${c.total} steps done</span>`; }
  else if (t.state === "resolved") { mode = "done"; nowHtml = `<span class="ck-m">${ICON.stop}</span><span>Resolved at ${c.done} of ${c.total}</span>`; }
  else nowHtml = `<span class="ck-m is-blue">${ICON.doing}</span><span>${esc(cur ? cur.text : "Working")}</span>`;
  const segs = c.items.map((i, k) => `<i class="sg s-${i.state}${fresh && k === c.done - 1 ? " is-pop" : ""}"></i>`).join("");
  const list = c.items.map((i) => `<li class="ck ck-${i.state}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${esc(i.text)}</span><span class="sr-only">, ${i.state === "doing" ? "in progress" : i.state}</span></li>`).join("");
  const html = `<div class="ckbar m-${mode}${open ? " is-open" : ""}">` +
    `<div class="ck-row"><button type="button" class="ck-tog" data-ck aria-expanded="${open}" aria-controls="${listId}" title="Checklist">` +
    `<span class="ck-segs" aria-hidden="true">${segs}</span><span class="ck-n">${c.done} of ${c.total}</span>` +
    `<span class="ck-now" data-mode="${mode}">${nowHtml}</span>${t.branch && SHAPE.on("xo:thread/branch") ? `<code class="ck-br">${ICON.branch}${esc(t.branch)}</code>` : ""}<span class="ck-chev">${ICON.chevron}</span></button></div>` +
    `<div class="ck-b"><ol class="ck-list" id="${listId}" aria-label="Checklist">${list}</ol></div></div>`;
  // in place: the toggle you pressed is the same element afterwards (it keeps focus), and so is a run's row
  const all = html + runsStrip(t);
  if (th._h !== all) { redraw(th, all); th._h = all; }
}

// ── sub-agents (U2, ch 14 §11): working now under the checklist; the list and each run in a sheet ──
const LIVE_RUN = (r) => r.state === "running" || r.state === "waiting";
const runsAsked = new Map(); // session → the working count its runs were last listed for
/** How many of a thread's sub-agents work now, by the best count known (the stream's, or the thread's). */
function workingRuns(t) {
  const lr = (world.state.liveRuns || {})[t.sessionId];
  return Math.max((t.runs && (t.runs.running || 0) + (t.runs.waiting || 0)) || 0, lr ? lr.running + lr.waiting : 0, (t.session && t.session.live_runs) || 0);
}
function runsStrip(t) {
  if (!t.sessionId || !world.state.runs) return "";
  const mine = [...world.state.runs.values()].filter((r) => r.session === t.sessionId && !r.hidden);
  const live = mine.filter((r) => LIVE_RUN(r) && (r.depth || 1) === 1);
  // after a reload the stream hasn't named the runs still working: the thread's counts know, so list them
  const working = workingRuns(t);
  // asked once per count: if the thread's counts stay stale after a read, the read isn't repeated
  if (working > mine.filter(LIVE_RUN).length && runsAsked.get(t.sessionId) !== working) {
    runsAsked.set(t.sessionId, working);
    world.act.listRuns(t.sessionId).then(() => schedule(), () => {});
  }
  const total = Math.max((t.runs && t.runs.total) || 0, mine.length);
  // a shape without sub-agent counts (xo:thread/subagents) keeps only a sub-agent that waits on you
  if (!SHAPE.on("xo:thread/subagents")) return runsStripHtml(live.filter((r) => r.state === "waiting"), 0);
  return runsStripHtml(live, total);
}
// Sub-agents: a page in the right panel, over the thread page it was opened from
const runsCard = document.createElement("div");
Object.assign(runsCard, { id: "runs-card", className: "runs-pg", tabIndex: -1 });
runsCard.setAttribute("role", "region");
runsCard.setAttribute("aria-label", "Sub-agents");
const RS = { cmdsOpen: true, cmdsAll: false, said: null, gen: 0, opening: 0, open: false, session: null, title: "", view: "list", tree: [], counts: null, runId: null, run: null, anc: null, items: [], cursor: null, children: [], loading: false, error: null, gone: null, pollT: null, returnTo: null };
const canStopRuns = () => !!(RS.session && world.act.feature && world.act.feature(RS.session, "runs.stop"));
// this page's own stops still in their Undo, where you acted
const sheetStops = () => pendingStops.filter((j) => !j.cancelled && !j.sent && j.session === RS.session).map((j) => ({ key: j.key, what: j.what }));
/** A control in the Sub-agents page as a selector, by its first data- hook's name and value ([data-run-stop="a1"]). */
const runsHook = (e) => { if (!e || !runsCard.contains(e) || e === runsCard || !e.attributes) return ""; const a = [...e.attributes].find((x) => x.name.startsWith("data-")); return a ? (a.value ? `[${a.name}="${CSS.escape(a.value)}"]` : `[${a.name}]`) : ""; };
function runsRender() {
  if (!RS.open) return;
  const html = RS.view === "list"
    ? runsListHtml(RS.tree, RS.counts, { canStop: canStopRuns(), stops: sheetStops(), state: RS.listState, error: RS.listErr, saidFor: RS.said, session: RS.session, out: [...stopsOut], cmdsOpen: RS.cmdsOpen, cmdsAll: RS.cmdsAll })
    : runViewHtml(RS.run || { id: RS.runId, title: "Sub-agent", state: "running" }, { anc: RS.anc, items: RS.items, children: RS.children, canStop: canStopRuns(), gone: RS.gone, error: RS.error, loading: RS.loading, stops: sheetStops(), saidFor: RS.said, out: [...stopsOut], open: S.tbOpen, cmdsOpen: RS.runCmds, cmdsAll: RS.cmdsAll });
  if (runsCard._h !== html) {
    const had = runsCard.contains(document.activeElement);
    const body = runsCard.querySelector(".rn-body");
    const keep = body ? body.scrollTop : 0;
    // the control with focus, found again by its hook if the redraw replaced it
    const hook = runsHook(document.activeElement);
    // in place: the control with focus (a Stop that gains its Undo line, a row) stays the same node
    redraw(runsCard, html); runsCard._h = html;
    const nb = runsCard.querySelector(".rn-body");
    if (nb && RS.keepScroll) nb.scrollTop = keep;
    if (had && !runsCard.contains(document.activeElement)) { const same = hook && runsCard.querySelector(hook); (same && usable(same) ? same : runsCard).focus({ preventScroll: true }); }
  }
}
/** ‹ and Esc: from a run to the list, its row in focus; from the list, back to the thread. */
function runsEscape() {
  if (RS.view !== "run") { closeRuns(); return; }
  const id = RS.runId;
  RS.gen++; RS.view = "list"; RS.runId = null; clearTimeout(RS.pollT); RS.keepScroll = false;
  runsRender(); STAGE.repaint();
  runsLand(`[data-run="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
const runsTitle = () => (RS.view === "run" ? (RS.run && /^(background_command|monitor)$/.test(RS.run.kind) ? "Command" : "Sub-agent") : "Sub-agents");
STAGE.page("runs", {
  over: true,
  title: runsTitle,
  backTo: () => (RS.view === "run" ? "Sub-agents" : RS.panelWas || STAGE.pageShown?.name !== "runs" ? "" : "the thread"),
  mount: (box) => box.append(runsCard),
  onShow: (_k, { focus } = {}) => { runsRender(); if (focus) runsCard.focus({ preventScroll: true }); },
  close: () => runsGone(),
  up: () => { runsEscape(); return true; },
  escape: () => { runsEscape(); return true; },
});
async function openRuns(t, runId = null) {
  if (!t || !t.sessionId) return;
  if (!RS.open) { RS.returnTo = document.activeElement; RS.head = (convAt(RS.returnTo) === MAIN ? $("#thead") : $("#tpthead")); }
  // a new thread's list starts empty and reading: never the last thread's rows, never "none" before a read says so
  if (RS.session !== t.sessionId) { RS.tree = []; RS.counts = null; RS.said = null; }
  // each opening (and each Try again) is its own: a list, or a run to open, asked for by an earlier opening of the
  // same thread never lands in this one (Astra SRC-MAIN-RUN-1: close, reopen, and the old answer won)
  const my = ++RS.opening;
  if (!RS.open) Object.assign(RS, { panelWas: STAGE.isOpen, cmdsOpen: true, cmdsAll: false });
  Object.assign(RS, { open: true, session: t.sessionId, title: t.title, view: runId ? "run" : "list", runId, keepScroll: false, listState: "loading", listErr: "" });
  if (!STAGE.show("runs", t.sessionId)) { RS.open = false; return; }
  await readRunsList(t.sessionId, my);
  if (!RS.open || RS.session !== t.sessionId || RS.opening !== my) return;
  if (runId) openRun(runId); else { runsRender(); runsLand()?.focus(); }
}
/** Where focus lands in Sub-agents once its list is drawn: Try again after a refusal, else the first run, else the page. */
function runsLand(...first) {
  const order = [...first, RS.listState === "error" ? "[data-runs-retry]" : null, ".rn-open", ".rn-cmd-b", "[data-runs-retry]"];
  return order.filter(Boolean).map((sel) => runsCard.querySelector(sel)).find(usable) || runsCard;
}
/** The list for one thread, for one opening; an answer for a thread, or an opening, that isn't the one open any
 *  more is dropped (Astra: a late list for A showed under B; and under A opened again). true when it landed. */
async function readRunsList(sid, my = RS.opening) {
  const mine = () => RS.open && RS.session === sid && RS.opening === my;
  try {
    const d = await world.act.listRuns(sid);
    if (!mine()) return false;
    RS.tree = d.runs || []; RS.counts = d.counts || null; RS.listState = "ok"; RS.listErr = "";
  } catch (err) {
    if (!mine()) return false;
    RS.listState = "error"; RS.listErr = err.message;
  }
  return true;
}
async function openRun(id) {
  clearTimeout(RS.pollT);
  const gen = ++RS.gen; // a read for another run (or a closed sheet) never writes into this one
  Object.assign(RS, { runCmds: false, view: "run", runId: id, run: world.state.runs.get(id) || null, anc: null, items: [], cursor: null, children: [], loading: true, error: null, gone: null, keepScroll: false });
  runsRender(); STAGE.repaint();
  try {
    const r = await world.act.run(id);
    if (gen !== RS.gen) return;
    RS.run = { ...(world.state.runs.get(id) || {}), ...r, title: r.title || r.agent_type || "Sub-agent" };
    RS.anc = r.ancestry || null;
    const findKids = (nodes) => { for (const n of nodes || []) { if (n.id === id) return n.children || []; const k = findKids(n.children); if (k) return k; } return null; };
    RS.children = findKids(RS.tree) || [];
  } catch (err) { if (gen !== RS.gen) return; RS.error = err.message; }
  STAGE.repaint();
  await readTranscript(id, gen);
}
/** Read the transcript; while the run works, read again from the last cursor and add only new items. */
async function readTranscript(id, gen) {
  const mine = () => RS.gen === gen && RS.runId === id && RS.open;
  if (!mine()) return;
  try {
    let more = true, guard = 0;
    while (more && guard++ < 20) {
      const d = await world.act.transcript(id, RS.cursor);
      if (!mine()) return;
      const have = new Set(RS.items.map((i) => i.id));
      RS.items.push(...(d.items || []).filter((i) => !have.has(i.id)));
      if (d.next) RS.cursor = d.next;
      more = !!d.next && (d.items || []).length > 0;
      // a long transcript shows as each page arrives, not after the last one
      if (more) { RS.loading = false; RS.keepScroll = true; runsRender(); }
    }
  } catch (err) {
    if (!mine()) return;
    if (err.code === "transcript_gone") RS.gone = err.summary || err.message;
    else if (err.status === 501) RS.error = "This agent can't show a sub-agent's work.";
    else RS.error = err.message;
  }
  RS.loading = false;
  RS.keepScroll = true;
  runsRender();
  const live = world.state.runs.get(id);
  if (mine() && (!live || LIVE_RUN(live)) && !RS.gone && !RS.error) RS.pollT = setTimeout(() => readTranscript(id, gen), 2500);
}
/** Back to the thread: the page steps back, or the panel closes if it opened for it. */
function closeRuns() {
  if (!RS.open) return;
  if (!RS.panelWas && STAGE.pageShown?.name === "runs") STAGE.close({ restore: false }); else STAGE.closePage("runs");
  // a phone's panel covers the chat: what opened it takes focus once the panel is gone
  const a = document.activeElement;
  if (!a || a === document.body) RS.refocus?.();
  RS.refocus = null;
}
// the page is gone (back, another place, the panel closed): focus, if it was here, goes back to what opened it
function runsGone() {
  if (!RS.open) return;
  const here = runsCard.contains(document.activeElement) || STAGE.owns(document.activeElement);
  clearTimeout(RS.pollT);
  RS.gen++; RS.open = false; runsCard.replaceChildren(); runsCard._h = "";
  const was = RS.returnTo;
  const like = (el) => { if (!el || !el.getAttribute) return null; for (const a of ["data-run-call", "data-run"]) if (el.hasAttribute(a)) return document.querySelector(`[${a}="${CSS.escape(el.getAttribute(a))}"]`); return el.hasAttribute("data-runs") ? RS.head?.querySelector("[data-runs]") : null; };
  RS.returnTo = null;
  const head = RS.head, to = () => [was, like(was), head?.querySelector("[data-runs]"), head === $("#tpthead") ? TP.C?.scroller : placeRegion()].find(usable)?.focus({ preventScroll: true });
  RS.refocus = here ? to : null;
  if (here) to();
}
/** Stop one sub-agent, or all of a session's, after a 3 s Undo. */
// Stops waiting out their Undo. One herald shows them all, so a second stop never hides the first's Undo.
const pendingStops = [];
const stopsOut = new Set(); // stop requests sent and not yet answered, by key
/** What a stop's answer confirms, and only that (the create-project grader on 2a8d278, S100/S101), each endpoint in its
 *  own type (routers/cowork_agent/storm/runs.py; the grader on 8d8b244, runs-stop-types): stop_run answers stopping
 *  true (sent) or false (it had ended: a record still working is refused, run_not_live); stop_all (all) answers the
 *  runs a stop went to, and [] when none went (they may have ended, or no live process runs them: never "finished").
 *  Anything else, the other endpoint's type included, confirms nothing. {kind, text, sub, say} for the notice, the
 *  sheet and the announcement. */
function stopReceipt(r, what, all) {
  const sent = !!r && (all ? Array.isArray(r.stopping) && r.stopping.length > 0 : r.stopping === true);
  if (sent) {
    const n = Array.isArray(r.stopping) ? r.stopping.length : 1;
    return { kind: "halt", text: "Stopping", sub: n > 1 ? `${n} sub-agents · what they did is kept` : `${what} · what it did is kept`, say: `Stopping ${what}. What it did is kept.` };
  }
  if (!all && r && r.stopping === false) return { kind: "halt", text: "It had already finished", sub: what, say: `${what} had already finished.` };
  if (all && r && Array.isArray(r.stopping) && !r.stopping.length) return { kind: "stopped", text: "No stop went out", sub: `${what}: none of them is running in a live session, though XO's record may still say they're working`, say: `No stop went out for ${what}: none of them is running in a live session.` };
  return { kind: "stopped", text: "Not confirmed", sub: `${what}: XO didn't confirm a stop was sent. Stop again if it keeps working.`, say: `XO didn't confirm the stop of ${what}.` };
}
function stopRunsUndo(what, fn, key = what, session = RS.session) {
  // a second Stop for the same run(s) while the first waits or is out does nothing (Astra: duplicate stops)
  if (pendingStops.some((j) => j.key === key && !j.cancelled) || stopsOut.has(key)) return;
  const job = { what, key, session, until: Date.now() + Kit.COMMIT_MS, cancelled: false, sent: false };
  if (RS.said && RS.said.key === key) RS.said = null; // a new stop of it: the last answer is over
  pendingStops.push(job);
  stopsHerald();
  runsRender();
  announce(`Stopping ${what} in 3 seconds. Undo to keep it.`);
  setTimeout(async () => {
    const i = pendingStops.indexOf(job);
    if (i >= 0) pendingStops.splice(i, 1);
    if (job.cancelled) return;
    job.sent = true;
    stopsHerald(); // its Undo is over: the line keeps only the stops still waiting
    // on its way: the sheet says so and its Stop waits, busy, taking no repeat, until the answer is said in its place
    // (the create-project grader on 8d8b244, request-visible: Stop stayed "Stop", enabled, and nothing was said)
    stopsOut.add(key);
    RS.said = { key, kind: "halt", text: "Sending the stop…", sub: what };
    runsRender();
    try {
      const r = await fn();
      // what the answer confirms, and only that (the create-project grader on 2a8d278, S100/S101)
      const said = stopReceipt(r, what, key.startsWith("all:"));
      heraldShow(said, said.kind === "halt" ? 3600 : 6000);
      RS.said = { key, ...said };
      announce(said.say);
    } catch (err) {
      // run_not_live: XO's record still says it's running, but nothing is running it that could be stopped. It
      // didn't "finish": say what's true (Astra RUN-6, from storm/runs/operations.py)
      if (err.code === "run_not_live") { RS.said = { key, kind: "stopped", text: "Couldn't stop it", sub: `${what}: nothing is running it any more, though XO's record still says it's running` }; heraldShow(RS.said, 6000); announce(`Couldn't stop ${what}: nothing is running it any more, though XO's record still says it's running.`); }
      else { RS.said = { key, kind: "stopped", text: "Couldn't stop it", sub: err.status === 501 ? "this agent can't stop a sub-agent; stop the thread instead" : err.message }; heraldShow(RS.said, 6000); announce(`Couldn't stop ${what}: ${RS.said.sub}.`); }
    } finally { stopsOut.delete(key); }
    if (RS.open && RS.session === session) { await readRunsList(session); runsRender(); }
  }, Kit.COMMIT_MS);
}
runsCard.addEventListener("click", (e) => {
  if (e.target.closest("[data-runs-cmds]")) { if (RS.view === "run") RS.runCmds = !RS.runCmds; else RS.cmdsOpen = !RS.cmdsOpen; RS.keepScroll = true; runsRender(); return; }
  if (e.target.closest("[data-runs-more]")) { RS.cmdsAll = true; RS.keepScroll = true; runsRender(); runsCard.querySelector(".rn-cmds li:nth-child(9) button")?.focus({ preventScroll: true }); return; }
  const tb = e.target.closest("[data-tb]");
  if (tb) { S.tbOpen[tb.dataset.tb] = !S.tbOpen[tb.dataset.tb]; RS.keepScroll = true; runsRender(); return; }
  const st = e.target.closest("[data-run-stop]");
  if (st) { const r = world.state.runs.get(st.dataset.runStop) || { title: "this sub-agent" }; stopRunsUndo(r.title, () => world.act.stopRun(st.dataset.runStop), `run:${st.dataset.runStop}`); return; }
  if (e.target.closest("[data-runs-stop]")) { const sid = RS.session; stopRunsUndo("every sub-agent of this thread", () => world.act.stopRuns(sid), `all:${sid}`); return; }
  // the sheet's own Undo for a stop still waiting: it keeps working; focus goes back to the Stop it undid
  const un = e.target.closest("[data-runs-undo]");
  if (un) {
    const job = pendingStops.find((j) => j.key === un.dataset.runsUndo && !j.cancelled && !j.sent);
    if (job) { job.cancelled = true; pendingStops.splice(pendingStops.indexOf(job), 1); stopsHerald(); announce(`Not stopped. ${job.what} keeps working.`); }
    const back = job && job.key.startsWith("run:") ? `[data-run-stop="${CSS.escape(job.key.slice(4))}"]` : "[data-runs-stop]";
    runsRender();
    runsLand(back)?.focus({ preventScroll: true });
    return;
  }
  if (e.target.closest("[data-runs-retry]")) { const sid = RS.session, my = ++RS.opening; RS.listState = "loading"; runsRender(); readRunsList(sid, my).then((landed) => { if (!landed) return; runsRender(); runsLand()?.focus({ preventScroll: true }); }); return; }
  const op = e.target.closest("[data-run]");
  if (op) openRun(op.dataset.run);
});

// ── the thread's own decision: docked above the composer (Today's card, #20) ──
const tdock = $("#tdock");
/**
 * A dock for a conversation's decision (the chat's #tdock, or a thread page's in the panel): one code path for both
 * (the owner, 19 Nov 17:52Z: the page's card couldn't be folded). Its card, its fold ("Read the thread first": ⌄,
 * or drag it down) to one slim line that still says a decision waits (tap it, or drag it up, to open it again), its
 * Undo, its fit. o: { el, view() (its conversation), region() (where focus goes when its card goes), TD }.
 */
function createDock({ el: tdock, view, region, TD = { key: null, item: null, busy: false, undone: null, gen: 0 } }) {
  const placeRegion = region;
/**
 * The dock's contents change under the keyboard: when focus was on what goes, it goes to what takes its place (the
 * card, the folded line), else the place, in the same step, so focus is never on the page, not even for a frame
 * (the create-project grader on 22046ec: S014, the docked Allow and its Undo; S240, Unfold).
 */
function dockSwap(fill, to = null, opts = null) {
  const had = tdock.contains(document.activeElement);
  const run = () => {
    fill();
    if (had && !tdock.contains(document.activeElement)) (to && usable(to) ? to : placeRegion()).focus({ preventScroll: true });
  };
  if (opts) morph(tdock, run, opts); else run();
}
/** Another conversation in this dock: what it showed goes with the state that drew it, and work still running for it stops. */
function reset() {
  Object.assign(TD, { key: null, item: null, busy: false, undone: null, gen: TD.gen + 1 });
  tdock._ch = "";
  dockRO.disconnect();
  dockSwap(() => tdock.replaceChildren());
}
  const keepBottom = () => {}; // pinned at the latest, follow.js keeps the view there as the card changes
/**
 * The docked card's fit (QA 2026-11-05). Its answers stay pinned under the question while the whole
 * question shows above them; on a short phone (375×667) the card is one scroll instead, question first,
 * so the answers never stand in for a question cut in half. Where it scrolls, the cut edge fades.
 */
const GONE_FRESH = 5000; // a withdrawal older than this was not what just emptied the dock
const DOCK_Q_ROOM = 8; // under the question's last line: the body's own bottom padding and a little air
function fitDock(frame) {
  const body = frame && frame.querySelector(".c-body");
  if (!body || !frame.isConnected) return;
  const h = body.querySelector(".c-h");
  if (frame.classList.contains("is-one")) frame.classList.remove("is-one");
  const one = !!h && h.getBoundingClientRect().bottom - body.getBoundingClientRect().top + DOCK_Q_ROOM > body.clientHeight + 0.5;
  frame.classList.toggle("is-one", one);
  // one scroll: the answers can start below the card's edge, so a pill on that edge says they're there
  let more = body.querySelector(".dock-more");
  if (one && !more) {
    more = document.createElement("button");
    more.type = "button";
    more.className = "dock-more";
    more.dataset.dockMore = "";
    more.innerHTML = `<span class="dm-p">Answers${ICON.chevron}</span>`;
    body.appendChild(more);
  } else if (!one && more) more.remove();
  dockEdges(frame);
}
function dockEdges(frame) {
  const sc = frame.classList.contains("is-one") ? frame.querySelector(".card-in") : frame.querySelector(".c-body");
  if (!sc) return;
  const more = sc.scrollHeight - sc.clientHeight > 1;
  sc.classList.toggle("fade-t", more && sc.scrollTop > 1);
  // in one scroll the "Answers" pill's own band is the bottom edge
  sc.classList.toggle("fade-b", more && !sc.matches(".card-in") && sc.scrollTop < sc.scrollHeight - sc.clientHeight - 1);
  // the answers in view: the "Answers" pill has said its piece and fades away
  const act = frame.querySelector(".c-act");
  if (act) frame.classList.toggle("ans-in", act.getBoundingClientRect().top < sc.getBoundingClientRect().bottom - 40);
  // the other scroller of the two never keeps a fade from the other mode
  const other = sc.matches(".c-body") ? frame.querySelector(".card-in") : frame.querySelector(".c-body");
  other?.classList.remove("fade-t", "fade-b");
}
const dockRO = new ResizeObserver(() => { const f = tdock.querySelector(".card.is-dock"); if (f) fitDock(f); });
tdock.addEventListener("scroll", () => { const f = tdock.querySelector(".card.is-dock"); if (f) dockEdges(f); }, { capture: true, passive: true });
function dockRender(needs) {
  // a chat: its "send now" question first, else its own open decision (the chat's host), as a thread docks one
  const hc = CH.isChats(view()) ? CH.confirmHtml(view()) : "";
  if (hc) { if (tdock._ch !== hc) { dockSwap(() => { tdock.innerHTML = hc; }); tdock._ch = hc; TD.key = null; } return; }
  if (tdock._ch) { tdock._ch = ""; dockSwap(() => { tdock.innerHTML = ""; }); TD.key = null; }
  if (view() === "chats") { if (TD.key) { TD.key = null; dockSwap(() => { tdock.innerHTML = ""; }); } return; }
  const t = convThread(view()) || convHost(view());
  const n = t && !D.isOpen() ? needs.find((x) => x.t.id === t.id && !x.later && (x.admitted || x.held)) : null;
  // Folded: the person chose to read the thread first. The ask waits as one slim line, and the
  // conversation isn't dimmed. A new ask on this thread docks open again.
  const folded = !!(n && S.dockFold[n.key]);
  const key = n ? n.key + (folded ? "|fold" : "") : null;
  if (TD.busy || key === TD.key) return;
  const prev = TD.key, gone = !n && prev ? world.state.gone.get(TD.item) : null;
  TD.key = key;
  TD.item = n && n.ask.item ? n.ask.item.id : null;
  if (!n) {
    if (!prev) { dockSwap(() => { tdock.innerHTML = ""; }); return; }
    if (gone && Date.now() - gone.at < GONE_FRESH) { goneRender(gone); return; }
    dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 300 });
    return;
  }
  const head = (() => { const tp = document.createElement("template"); tp.innerHTML = D.cardHtml(n, "dock").trim(); return tp.content.querySelector(".c-h")?.textContent.trim() || askShort(n); })();
  if (folded) {
    const E = EFFORT[n.effort];
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = `dock-fold r-${n.risk}`;
    bar.dataset.unfold = n.key;
    bar.title = "Open the decision";
    bar.innerHTML = `${stateMark(n.group === "stopped" ? "failed" : "needs_reply")}<span class="df-t">${esc(head)}</span><span class="df-e">${esc(E.label)} ${esc(E.time)}</span><span class="df-go">Open ${ICON.chevron}</span>`;
    dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(bar); }, bar, { duration: 300 });
    return;
  }
  const frame = document.createElement("article");
  frame.className = `card is-dock r-${n.risk} e-${n.effort}`;
  frame.tabIndex = -1;
  frame.setAttribute("aria-roledescription", "decision");
  frame.innerHTML = `<div class="stamp stamp-allow" aria-hidden="true">${ICON.stampAllow}</div><div class="stamp stamp-back" aria-hidden="true">${ICON.stampBack}</div>`;
  const tpl = document.createElement("template");
  tpl.innerHTML = D.cardHtml(n, "dock").trim();
  const inner = tpl.content.firstElementChild;
  frame.appendChild(inner);
  frame.setAttribute("aria-labelledby", inner.querySelector(".c-h").id);
  const what = t.host ? "chat" : "thread";
  // it sits in the card's own top row, on the effort label's line (hub #27), not floating over it
  (inner.querySelector(".c-top") || frame).insertAdjacentHTML("beforeend", `<button type="button" class="dock-hide" data-fold="${esc(n.key)}" title="Fold it away and read the ${what} first">${ICON.chevron}<span>Read the ${what} first</span></button>`);
  dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(frame); fitDock(frame); }, frame, { duration: prev ? 300 : 360, fade: frame });
  dockRO.disconnect();
  for (const el of [frame, frame.querySelector(".c-body"), frame.querySelector(".c-act")]) if (el) dockRO.observe(el);
  D.wireCard(frame, inner, n, {
    surface: "dock",
    onStep: keepBottom,
    after: async (how) => {
      TD.busy = true;
      const gen = TD.gen;
      if (!RM.matches && how !== "later") { frame.classList.add(`st-${how}`); await wait(380); if (TD.gen !== gen) return; }
      if (how !== "later") {
        // one calm line in place of the card, then it folds away
        const e = D.decisions()[0];
        const verb = e && e.verb === "Answered" ? `Answered “${e.said}”` : e ? e.verb : "Done";
        // the control pressed (Allow, an option, Send) goes with the card: focus goes to this line's Undo, at once
        const had = frame.contains(document.activeElement);
        morph(frame, () => {
          frame.className = "card is-dock r-done"; frame.innerHTML = `<p class="tp-done${how === "back" ? " is-back" : ""}" role="status"><span class="tp-done-ic">${how === "back" ? ICON.rewind : ICON.check}</span><span title="${esc(verb)}."><b>${esc(verb)}.</b> ${how === "back" ? "It's taking another route." : "It's back at work."}</span><button type="button" class="tp-done-u" data-dock-undo>Undo</button></p>`;
          if (had && !frame.contains(document.activeElement)) frame.querySelector("[data-dock-undo]").focus({ preventScroll: true });
        }, { duration: 300 });
        // the only Undo for this decision now: it stays for the whole 3 s window, in real time (hold, not wait:
        // reduced motion cuts the stamp's animation, never the time to Undo). Undone, the line ends there and then:
        // the card is back at once, and focus with it if it was on the Undo
        let undone = false;
        await new Promise((end) => { TD.undone = { key: n.key, end: () => { undone = true; end(); } }; hold(RM.matches ? 3000 : 2700).then(end); });
        if (TD.gen !== gen) return;
        TD.undone = null;
        if (undone) { TD.busy = false; TD.key = null; dockRender(D.needItems()); schedule(); return; }
      }
      TD.busy = false;
      TD.key = "__settling";
      dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 320 });
      TD.key = null;
      schedule();
    },
  });
}
/** The item withdrawn or expired under the dock: one line says so for 3 s, in Space's words, then the dock clears. */
async function goneRender(g) {
  const L = goneLine(g);
  const line = document.createElement("article");
  line.className = "card is-dock r-done";
  line.innerHTML = `<p class="tp-done is-gone" role="status"><span class="tp-done-ic">${ICON.clock}</span><span title="${esc(`${L.head}. ${L.text}`)}"><b>${esc(L.head)}.</b> ${esc(L.text)}</span></p>`;
  TD.busy = true;
  dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(line); }, null, { duration: 300 });
  const gen = TD.gen;
  await hold(3000);
  if (TD.gen !== gen) return;
  TD.busy = false;
  TD.key = "__settling";
  dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 320 });
  TD.key = null;
  schedule();
}
tdock.addEventListener("click", (e) => {
  if (e.target.closest("[data-dock-more]")) { tdock.querySelector(".card.is-dock .c-act")?.scrollIntoView({ block: "end", behavior: RM.matches ? "auto" : "smooth" }); return; }
  const f = e.target.closest("[data-fold]");
  if (f) { S.dockFold[f.dataset.fold] = true; dockRender(D.needItems()); placeRegion().focus({ preventScroll: true }); return; }
  const u = e.target.closest("[data-unfold]");
  // the card takes focus in the step that draws it, not a frame later: the line pressed is gone by then (S240)
  if (u) { delete S.dockFold[u.dataset.unfold]; dockRender(D.needItems()); tdock.querySelector(".card")?.focus({ preventScroll: true }); return; }
  if (e.target.closest("[data-dock-undo]")) D.undo();
});
tdock.addEventListener("keydown", (e) => {
  const card = tdock.querySelector(".card");
  if (!card) return;
  D.cardKeys(e, card, {});
});
  dockGestures(tdock);
  return { render: dockRender, reset, TD, el: tdock };
}
const MDOCK = createDock({ el: tdock, view: () => S.view, region: () => placeRegion(), TD: { key: null, item: null, busy: false, undone: null, gen: 0 } });
const TD = MDOCK.TD;
const dockRender = (needs) => MDOCK.render(needs);

// ── typing ──────────────────────────────────────────────────────────────────
/**
 * The "working" line under a conversation: the agent's own mark, still, with one small arc turning at its
 * corner, then plain words and the time so far. The element stays put while the agent works; only its
 * words change, so neither the arc nor the words' soft wave (the shimmer) restarts or stutters. No bouncing dots.
 */
/** An ask this project's coordinator sent to the Workspace that isn't answered yet. xo-space publishes the hop
    when the call happens ("sent"), marks it "delivered" when the Workspace's turn takes it and "answered" when
    the answer is made. Only an ask waits for a reply (a relay or a forward doesn't), and only for 20 minutes:
    an ask nobody answers mustn't hold the line for ever. */
function openAsk(project) {
  const chatId = world.project(project)?.chatId;
  if (!chatId || !world.state.hops) return null;
  let best = null, at = 0;
  for (const h of world.state.hops.values()) {
    if (h.chat_id !== chatId || h.kind !== "ask" || h.from_role !== "project-coordinator" || !(h.state === "sent" || h.state === "delivered")) continue;
    const t = Date.parse(h.created_at || h.at || "") || 0;
    if (t && Date.now() - t < 20 * 60e3 && t > at) { best = h; at = t; }
  }
  return best;
}
// your message to a chat on its way: its coordinator's line shows from the moment you send
const sendingTo = (chat) => (S.local[convOfChat(chat)] || []).find((m) => m.status === "sending" && m.target === chat) || null;
function typingRender(C = MAIN) {
  const box = C.typing, view = C.view;
  const t = convThread(view);
  let spec = null;
  const chat = !t && view !== "home" ? chatOf(view) : null;
  // held back by a gate (the usage limit…): nothing runs, so no arc, no shimmer and no clock, only what it
  // waits for and until when (timeline.js heldWords), in the pause's amber
  const coHeld = chat && world.act.coordinatorHeld ? world.act.coordinatorHeld(chat) : null;
  const chHeld = !chat && view.startsWith("c:") && world.act.sessionHeld ? world.act.sessionHeld(view.slice(2)) : null;
  // a thread's own wait shows here even while an item on it asks you (it's true, and the item says the rest)
  const held = coHeld || chHeld || (t && t.held && !isBusy(t) && t.state !== "resolved" ? t.held : null);
  if (held) {
    const who = coHeld ? (view === "ws" ? "The coordinator" : `${PROJ(chat)} coordinator`) : "";
    const words = heldWords(held);
    spec = { key: `held:${coHeld ? chat : chHeld ? view : t.id}`, cls: "av-live is-wait", icon: coHeld ? XO : ICON.thread, text: who ? `${who} · ${words.replace(/^\w/, (c) => c.toLowerCase())}` : words, since: null, wait: true };
    // the words change when its reset passes ("starts at 6:50 AM" → "to reset"): drawn again then, not at a chance render
    clearTimeout(S.heldT);
    const at = Date.parse(held.until || "");
    if (at > Date.now()) S.heldT = setTimeout(schedule, Math.min(at - Date.now() + 50, 2 ** 31 - 1));
  } else if (chat && (world.act.replying(chat) || sendingTo(chat))) {
    // the coordinator's session really works, or our message still waits for its answer (never a timer)
    const aw = world.state.awaiting[chat];
    const who = view === "ws" ? "The coordinator" : `${PROJ(chat)} coordinator`;
    const doing = world.act.doing ? world.act.doing(chat) : null;
    const out = aw || sendingTo(chat);
    spec = { key: `co:${chat}`, cls: "av-w", icon: XO, text: doing ? `${who} · ${doing.replace(/`/g, "")}` : `${who} is ${out ? "replying" : "working"}`, since: out ? out.at : null };
  } else if (chat && chat !== "workspace" && openAsk(chat)) {
    // its coordinator asked the Workspace and the answer hasn't come: said only while that hop is open
    const ask = openAsk(chat);
    spec = { key: `ask:${ask.id}`, cls: "av-w", icon: XO, text: `${PROJ(chat)} coordinator · Waiting for the Workspace coordinator to reply`, since: null };
    // the line goes when its 20 minutes are up, not at the next render that happens to come along
    clearTimeout(S.askT);
    S.askT = setTimeout(schedule, Math.max(0, (Date.parse(ask.created_at || ask.at || "") || Date.now()) + 20 * 60e3 - Date.now()) + 50);
  } else if (view.startsWith("c:")) {
    const sid = view.slice(2), tu = world.state.turns && world.state.turns.running(sid);
    if (CH.working(view) && !(tu && world.state.turns.blocksOf(tu).length)) spec = { key: `c:${sid}`, cls: "av-live", icon: ICON.thread, text: "Working", since: null };
  } else if (t && t.sessionId && world.state.turns && world.state.turns.running(t.sessionId) && world.state.turns.blocksOf(world.state.turns.running(t.sessionId)).length) {
    spec = null; // its running turn shows the work itself
  } else if (t && isBusy(t)) {
    const cur = t.checklist.items.find((i) => i.state === "doing");
    spec = { key: `t:${t.id}`, cls: "av-live", icon: ICON.thread, text: `Working${cur ? ` · ${cur.text}` : ""}`, since: t.lastAt };
  }
  let changed = false;
  if (!spec) {
    if (box._k != null) { box.innerHTML = ""; box._k = null; box._h = ""; changed = true; }
    return changed;
  }
  if (box._k !== spec.key) {
    box.innerHTML = spec.wait
      ? `<div class="typing is-held" role="status"><div class="av ${spec.cls}">${spec.icon}</div><div class="ty-b"><span class="ty-t"></span><span class="elapsed"></span></div></div>`
      : `<div class="typing" role="status"><div class="av ${spec.cls}">${spec.icon}${ARC}</div><div class="ty-b">${DOTS}<span class="ty-t shimmer"></span><span class="elapsed"></span></div></div>`;
    box._k = spec.key; box._h = spec.key;
    changed = true;
  }
  const tx = box.querySelector(".ty-t");
  if (tx.textContent !== spec.text) tx.textContent = spec.text;
  const el = box.querySelector(".elapsed");
  if (spec.since) el.dataset.since = spec.since; else { delete el.dataset.since; el.textContent = ""; }
  tickElapsed();
  return changed;
}
// only a clock whose words changed is written (a rewrite is a mutation every layer reacts to)
function tickElapsed() { for (const el of $$(".elapsed[data-since]")) { const t = elapsed(Math.max(0, Math.floor((Date.now() - +el.dataset.since) / 1000))); if (el.textContent !== t) el.textContent = t; } }
setInterval(tickElapsed, 1000);

// ── the dock line: one calm labelled line (no glow on the composer, ever) ───
// the herald's lines (js/herald.js): made on first use (S is the app's state), so a line asked for while the app is
// still starting has it
function HER() { return S._her || (S._her = createHerald({ state: S, schedule: () => schedule() })); }
regionRings(); // the keyboard's ring over a file's or a change's region (js/ring.js)
keepFocusInView(); // focus a script hands on is never left out of sight (js/focusview.js)
function heraldShow(h, ms) { return HER().show(h, ms); }
function toastLine(text) { announce(text); heraldShow({ kind: "done", text }, 1600); }
/** A message's own notice, set in place (on screen, or still waiting): see js/herald.js */
function heraldFor(mid, make, ms) { return HER().forMsg(mid, make, ms); }
function heraldPut(h, ms) { return HER().put(h, ms); }
function heraldNext() { return HER().next(); }
/** A subject's notice that's no longer true goes, on screen or waiting (js/herald.js drop). */
function heraldDrop(mid) { return HER().drop(mid); }
/** The notices' line of the conversation in use (the panel's thread page has its own); the other one is empty. */
const heraldBox = () => (composerNow() === MK ? $("#herald") : $("#tpherald"));
function heraldRender(needs) {
  const box = heraldBox();
  for (const o of [$("#herald"), $("#tpherald")]) if (o && o !== box && o.firstChild) { if (o.contains(document.activeElement)) heraldBack(o._line)?.focus({ preventScroll: true }); patch(o, ""); o._line = null; o._h = null; }
  const h = S.herald && S.herald.until > Date.now() ? S.herald : null;
  let html;
  if (h) {
    const ic = h.kind === "stopped" ? `<span class="hr-ic k-stopped">${ICON.close}</span>` : h.kind === "sent" ? `<i class="dash" aria-hidden="true"></i>` : h.kind === "ping" ? `<span class="hr-ic k-ping"><i class="hr-dot"></i></span>` : h.kind === "calm" || h.kind === "halt" ? `<span class="hr-ic k-calm">${h.kind === "halt" ? STOP_ICON : ICON.pause}</span>` : h.kind === "rec" ? `<span class="hr-ic k-calm">${ICON.router}</span>` : `<span class="hr-ic k-ok">${ICON.check}</span>`;
    const inner = `${ic}<span class="hr-t">${esc(h.text)}</span>${h.sub ? `<span class="hr-s">${esc(h.sub)}</span>` : ""}${h.open ? `<span class="hr-go">Open ${ICON.arrow}</span>` : h.decide ? `<span class="hr-go">Look ${ICON.arrow}</span>` : ""}`;
    html = h.open ? `<button type="button" class="hr hr-ev k-${h.kind}" data-go="${esc(h.open)}" data-hn="${h.n}">${inner}</button>`
      : h.decide ? `<button type="button" class="hr hr-ev k-${h.kind}" data-decide="${esc(h.decide)}" data-hn="${h.n}">${inner}</button>`
      : h.undo ? `<div class="hr hr-ev has-undo k-${h.kind}" data-hn="${h.n}">${inner}<button type="button" class="hr-undo" data-herald-undo>${esc(h.undoLabel || "Undo")}</button></div>`
      : `<div class="hr hr-ev k-${h.kind}" data-hn="${h.n}">${inner}</div>`;
  } else if (connLine(world.state, box === $("#herald") ? connDest() : { thread: true })) {
    // an honest, persistent line when XO can't be reached, can't run, or waits on a limit (P0-8); routing Off only
    // for where the composer's draft goes, the send gate's own destination: never beside a thread's reply
    const c = connLine(world.state, box === $("#herald") ? connDest() : { thread: true });
    html = `<div class="hr hr-conn k-${c.kind}" role="status"><span class="hr-ic ${c.kind === "down" ? "k-stopped" : "k-calm"}">${c.kind === "down" ? ICON.retry : ICON.pause}</span><span class="hr-t">${esc(c.text)}</span><span class="hr-s">${esc(c.sub)}</span></div>`;
  } else if (S.view === "home" || convThread(S.view)) html = "";
  else {
    // Only when something is worth your time. The quiet state ("Nothing needs you")
    // are already said by the sidebar's Home row and by Home, so no line sits here for them.
    const P0 = homeParts(needs);
    const nd = P0.active.length;
    html = ""; // what needs you is said once: the sidebar's Home row, then Home
  }
  const was = box._h;
  // the line with the control you're on goes (its Undo's window ended): focus goes on first, to what it acted on,
  // else the message box, never the page (Astra RUN-5)
  const fa = document.activeElement;
  if (fa && fa !== box && box.contains(fa) && !(h && fa.closest(`[data-hn="${h.n}"]`))) heraldBack(box._line)?.focus({ preventScroll: true });
  if (patch(box, html) && was != null && html) box.firstElementChild?.classList.add("is-in");
  box._line = h;
  heraldRoom();
}
/**
 * The notices' line sits on the dock's top, over the conversation's foot (css/app.css .herald). The conversation
 * keeps room for it while it shows there (--herald-room, css/msgx.css .scroller), so it never covers the last
 * bubble or the line under it ("Paused until 6:50 AM" over "Waiting for the usage limit…"). Measured, not assumed:
 * its height and how far it stands above the dock change with the width and with what's docked (is-stacked). A hidden
 * line takes no room. follow.js keeps the latest pinned as
 * the room changes (it watches the scroller's box).
 */
function heraldRoom() {
  for (const [box, dock, host] of [[$("#herald"), $("#dock"), $("#app")], [$("#tpherald"), $("#tpdock"), TP.box]]) {
    if (!box) continue;
    const line = box.firstElementChild;
    const shown = line && line.getClientRects().length > 0;
    const px = shown ? Math.max(0, Math.round(dock.getBoundingClientRect().top - box.getBoundingClientRect().top)) : 0;
    const v = px ? `${px + 8}px` : "0px";
    if (host.style.getPropertyValue("--herald-room") !== v) host.style.setProperty("--herald-room", v);
  }
}
/** Where focus goes when a notice's line goes from under it: the control the notice acts on (h.back: selectors,
 *  e.g. the thread's Resolve, or Interrupt), else the message box, else the place's own region. */
function heraldBack(h) { return [...((h && h.back) || []).map((sel) => (typeof sel === "function" ? sel() : $(sel))), composerNow().say].find(usable) || placeRegion(); }
/** A notice's control in the conversation in use: its Send, or one in its own page. */
const inUse = (sel) => () => { const K = composerNow(); return sel === "#send" ? K.send : K.main ? $(sel) : TP.box.querySelector(sel); };

// ── intelligence: the record line and the chip ─────────────────────────────
function recordLine(session, rec) {
  const conv = session;
  const m = { id: `rec${++S.n}`, who: "rec", at: Date.now(), text: rec.text, refused: !!rec.refused, undo: rec.undo || null, until: Date.now() + 3000 };
  (S.local[conv] = S.local[conv] || []).push(m);
  // its Undo goes when its window ends: if it holds focus then, the conversation takes it first (S004)
  if (rec.undo) setTimeout(() => { recUndoLeaves(m.id); schedule(); }, 3050);
  if (S.view === "home" || (S.view !== conv)) heraldShow({ kind: "rec", text: rec.text, undo: rec.undo ? m.id : null, undoUntil: rec.undo ? m.until : 0 }, rec.undo ? 3200 : 4200);
  announce(rec.text);
  schedule();
}
/** A record line's Undo is drawn only while it can undo: when it goes (pressed, or its window over) and holds focus,
 *  the conversation it's in takes focus first, before the line is drawn again without it, never the page (the
 *  create-project grader on 24be023, S004: Undo pressed, the line said "undone", focus on BODY) */
function recUndoLeaves(id) {
  const b = document.activeElement?.closest?.(`[data-rec-undo="${CSS.escape(id)}"]`);
  if (b) placeRegion().focus({ preventScroll: true });
}
function undoRecord(id) {
  for (const list of Object.values(S.local)) {
    const m = list.find((x) => x.id === id);
    if (m && m.undo && Date.now() < m.until) {
      recUndoLeaves(id);
      m.undo(); m.undo = null;
      m.text = `${m.text} · undone`;
      announce("Undone.");
      if (S.herald && S.herald.undo === id) { S.herald.until = 0; heraldNext(); }
      schedule();
      return;
    }
  }
}
function chipRender(fade = false, K = MK) {
  const chip = K.iq;
  if (!chip) return;
  // a chat's agent, model and thinking are its own (js/chats.js), not the router's: a new chat's to choose, an open chat's fixed
  const s = sessionOf(K.view);
  const chat = CH.isChats(K.view) && K === MK, fixed = chat && K.view !== "chats";
  chip.hidden = chat ? !CH.chipHtml(K.view) : CH.isChats(K.view) || !IQ.kindOf(s);
  if (chip.hidden) return;
  const html = chat ? CH.chipHtml(K.view) : IQ.chipHtml(s, PHONE.matches);
  const title = chat ? CH.chipTitle(K.view) : IQ.chipTitle(s);
  chip.title = title;
  chip.setAttribute("aria-label", `Intelligence: ${title.replace(/ \([^)]*\)$/, "")}`);
  chip.setAttribute("aria-controls", chat ? "cs-pop" : "iq-pop");
  fixChip(chip, fixed);
  chip.classList.toggle("is-pinned", !chat && IQ.current(s).pinned);
  if (chip._h === html) return;
  const swap = () => { redraw(chip, html); chip._h = html; }; // in place: the chip's insides stay the nodes a press is on
  if (fade && chip._h && !RM.matches) {
    chip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, fill: "forwards" }).finished.then(() => { swap(); chip.getAnimations().forEach((a) => a.cancel()); chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 80 }); });
  } else swap();
}

// ── the composer: send, or Stop while something runs ───────────────────────
const say = $("#say"), atList = $("#at-list");
/**
 * A composer (P1, step 6): the main chat's (MK: #say and its form, the @ list, files, lines, the model chip) or a
 * thread page's in the panel (its own field, Send and target line; a reply in its thread). Its view is its
 * conversation's; sendLive, send, sendRender, the target line, the placeholder, the draft and Stop take it.
 */
const MK = { main: true, get view() { return S.view; }, say, send: $("#send"), form: $("#composer"), target: $("#target"), label: $("#say-label"), get conv() { return MAIN; },
  tray: $("#att-tray"), attach: $("#attach"), input: $("#att-input"), note: $("#att-note"), iq: $("#iq"), at: atList };
/** A thread page's composer, wired: Enter sends (Shift+Enter a new line), Esc leaves the field, Send or Stop. */
function wireComposer(K) {
  K.say.addEventListener("input", () => { K.at._sel = 0; updateComposer(K); saveDraft(K); });
  K.say.addEventListener("click", () => updateComposer(K));
  K.say.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
    if (atKeys(e, K)) return;
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(K); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); K.say.blur(); }
  });
  K.form.addEventListener("submit", (e) => { e.preventDefault(); if (K.send.dataset.mode === "stop") stopRun(K.view); else send(K); });
  wireAt(K);
  K.target.addEventListener("click", () => aimAt(K));
}

// ── files on the unsent message (hub #30): the paperclip, a drop or a paste adds them; each uploads
// at once to the chat this conversation writes to, as a chip with its progress, Retry and Remove.
// Send waits for every upload and stays off while one has failed. A long paste becomes a file.
const trayEl = $("#att-tray"), attInput = $("#att-input");
let trayRaf = 0;
const tray = createTray({ upload: uploadAttachment, onChange: () => { if (!trayRaf) trayRaf = requestAnimationFrame(() => { trayRaf = 0; trayRender(); sendRender(); }); } });
/** Storm conversations take files; a plain chat (Chats) has no route for them. */
const canAttach = (v) => v !== "chats" && !CH.isChats(v);
/** The chat id a file added here uploads to: the Workspace, the project, or the thread's project. */
const attachChat = (v) => { const p = chatOf(v); return p && world.act.chatId ? world.act.chatId(p) : null; };
const filesHere = (view = S.view) => (canAttach(view) ? tray.status(view) : { count: 0, busy: false, failed: false });
// An image chip shows the picture itself, from the bytes the browser already holds: no request.
const thumbs = new WeakMap(); // blob → object URL, freed when the chip leaves the composer
const thumbOf = (c) => { let u = thumbs.get(c.blob); if (!u) { u = URL.createObjectURL(c.blob); thumbs.set(c.blob, u); } return u; };
const dropThumb = (c) => { const u = c && thumbs.get(c.blob); if (u) { URL.revokeObjectURL(u); thumbs.delete(c.blob); } };
function chipHtml(c) {
  const img = c.type ? kindOf(c.type) === "image" : /^image\//.test(c.blob?.type || "");
  const thumb = img && c.blob && c.state !== "failed";
  // once uploaded it opens in the viewer, like a sent message's file
  const ic = thumb ? `<img src="${esc(thumbOf(c))}" alt="" decoding="async">` : img ? ICON.image : ICON.doc;
  const state = c.state === "failed" ? `<span class="att-err">${esc(uploadErrorText(c.err))}</span>`
    : c.state === "uploading" ? `<span class="att-pct">Uploading</span>` : "";
  const sub = [c.paste ? esc(c.name) : esc(fmtSize(c.bytes ?? c.size)), state].filter(Boolean).join(" · ");
  const btn = (a, label, icon, extra = "") => `<button type="button" class="att-b" data-a="${a}" aria-label="${esc(label)}" title="${esc(label)}"${extra}>${icon}</button>`;
  return `<li class="att st-${c.state}${c.paste ? " is-paste" : ""}" data-lid="${esc(c.lid)}"${c.err ? ` title="${esc(c.err.message || "")}"` : ""}>` +
    (thumb && c.id ? `<button type="button" class="att-ic is-img" data-a="view" aria-label="Preview ${esc(c.name)}" title="Preview">${ic}</button>` : `<span class="att-ic${thumb ? " is-img" : ""}">${ic}</span>`) +
    `<span class="att-t"><span class="att-n">${esc(c.paste ? pasteLabel(c.paste) : c.name)}</span><span class="att-m">${sub}</span></span>` +
    (c.paste ? btn("view", "Preview the pasted text", ICON.eye) + `<button type="button" class="att-tx" data-a="inline" title="Put it back in the message as text">As text</button>` : "") +
    (c.state === "failed" && !FINAL.has(c.err?.code) ? btn("retry", `Retry ${c.name}`, ICON.retry) : "") +
    btn("x", `Remove ${c.paste ? "the pasted text" : c.name}`, ICON.close) +
    `<i class="att-bar" aria-hidden="true"></i></li>`;
}
function trayRender(K = MK) {
  const on = canAttach(K.view);
  K.attach.hidden = !on;
  const list = on ? tray.list(K.view) : [];
  K.tray.hidden = !list.length;
  K.note.hidden = !list.length;
  K.form.classList.toggle("has-files", !!list.length);
  const html = list.map(chipHtml).join("");
  // in place (js/redraw.js): a chip whose upload finishes or fails is the same chip, its Remove the same button,
  // so a focused Remove keeps focus (Astra H28)
  if (K.tray._h !== html) { redraw(K.tray, html); K.tray._h = html; }
  // progress moves without redrawing the chips (a focused Remove stays focused)
  for (const c of list) {
    const el = K.tray.querySelector(`[data-lid="${CSS.escape(c.lid)}"]`);
    if (!el) continue;
    const p = c.state === "uploading" ? Math.min(1, (c.sent || 0) / Math.max(1, c.size)) : c.state === "done" ? 1 : 0;
    el.style.setProperty("--p", String(p));
    const pct = el.querySelector(".att-pct");
    if (pct) pct.textContent = c.sent ? `${Math.floor(p * 100)}%` : "Uploading";
  }
}
function addFiles(files, K = MK) {
  const list = [...(files || [])];
  if (!list.length) return;
  if (!canAttach(K.view)) { announce("Files can't be attached in this conversation."); return; }
  const chat = attachChat(K.view);
  if (!chat) { heraldShow({ kind: "stopped", text: "Files can't be attached yet", sub: "still connecting to XO" }, 4600); return; }
  const refused = tray.add(K.view, chat, list);
  const took = list.length - refused.length;
  if (refused.length) {
    heraldShow({ kind: "stopped", text: refused.length === 1 ? `${refused[0].name} wasn't attached` : `${refused.length} files weren't attached`, sub: refused[0].why }, 6000);
    announce(`${refused.map((r) => `${r.name}: ${r.why}`).join(" ")}`);
  }
  if (took) announce(`${took === 1 ? "1 file" : `${took} files`} uploading.`);
  updateComposer(K);
  K.say.focus({ preventScroll: true });
}
function insertText(text, K = MK) {
  K.say.focus({ preventScroll: true });
  K.say.setRangeText(text, K.say.selectionStart, K.say.selectionEnd, "end");
  updateComposer(K); saveDraft(K);
}
$("#attach").innerHTML = ICON.clip;
$("#attach").addEventListener("click", () => attInput.click());
attInput.addEventListener("change", () => { addFiles(attInput.files); attInput.value = ""; });
function wireTray(K) {
K.tray.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  const li = b && b.closest("[data-lid]");
  if (!li) return;
  const lid = li.dataset.lid, c = tray.list(K.view).find((x) => x.lid === lid);
  if (!c) return;
  if (b.dataset.a === "x") {
    // just drop its id: the server sweeps a file no message names. Focus goes on first, to the next chip's Remove
    // (or the composer), so it never sits on a chip that's going
    const next = li.nextElementSibling?.querySelector("[data-a=x]") || li.previousElementSibling?.querySelector("[data-a=x]");
    if (li.contains(document.activeElement)) (next || K.say).focus({ preventScroll: true });
    dropThumb(tray.remove(K.view, lid));
    announce(`${c.paste ? "The pasted text" : c.name} removed.`);
    trayRender(K);
  } else if (b.dataset.a === "retry") {
    // Retry goes as the upload starts again: focus moves first to the same chip's Remove, which stays (H28)
    if (b === document.activeElement) li.querySelector("[data-a=x]")?.focus({ preventScroll: true });
    tray.retry(K.view, lid);
    trayRender(K);
  }
  else if (b.dataset.a === "view") VW.open(c.paste != null ? { name: c.name, bytes: c.size, local: c.paste } : { name: c.name, type: c.type, bytes: c.bytes ?? c.size, att: { chat: c.chat, id: c.id } }, b);
  else if (b.dataset.a === "inline") { tray.remove(K.view, lid); insertText(c.paste, K); announce("The pasted text is back in the message."); }
});
K.say.addEventListener("paste", (e) => {
  const cd = e.clipboardData;
  if (!cd || !canAttach(K.view)) return;
  const files = [...(cd.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files, K); return; }
  const text = cd.getData("text/plain");
  if (!text || !isLargePaste(text)) return;
  const chat = attachChat(K.view);
  if (!chat) return; // not connected yet: it goes in as text
  e.preventDefault();
  if (!tray.addPaste(K.view, chat, text)) { insertText(text, K); announce(`A message takes at most ${MAX_FILES} files, so the paste went in as text.`); return; }
  announce("The long paste was added as a file. As text puts it back in the message.");
  updateComposer(K);
});
}
wireTray(MK);
// a drop anywhere on the page adds the files to the message being written
{
  const veil = $("#drop-veil");
  $("#drop-ic").innerHTML = ICON.clip;
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const hide = () => { depth = 0; veil.hidden = true; };
  // only where the message being written can take it: on screen and in reach, under no open layer (Settings,
  // a sheet, a dialog, the phone's drawer make it inert): never into a composer that's hidden (Astra H29)
  const takes = (K) => canAttach(K.view) && K.say.getClientRects().length > 0 && !K.say.closest("[inert]") && !document.querySelector(".sheet:not([hidden]), dialog[open]");
  addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (takes(composerAt(e.target))) { depth++; veil.hidden = false; } });
  addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = veil.hidden ? "none" : "copy"; });
  addEventListener("dragleave", (e) => { if (hasFiles(e) && --depth <= 0) hide(); });
  addEventListener("drop", (e) => { if (!hasFiles(e)) return; e.preventDefault(); const on = !veil.hidden, K = composerAt(e.target); hide(); if (on && takes(K)) addFiles(e.dataTransfer.files, K); });
  addEventListener("dragend", hide);
}
function growSay(K = MK) {
  K.say.style.height = "auto";
  const h = K.say.scrollHeight;
  K.say.style.height = Math.min(h, 200) + "px";
  K.say.classList.toggle("is-capped", h > 200);
}
/** What would Stop stop here? The coordinator replying, or this thread's agent working. */
// (P1: each conversation's own: view defaults to the main chat's, a thread page in the panel passes its own)
function running(view = S.view) {
  // a thread whose session works, or the coordinator of this chat while it works
  // nothing more to stop where a Stop waits out its Undo or is on its way, or the session is stopping
  const live = (run) => (run && !S.stops.has(run.session) && world.act.sessionState(run.session) !== "stopping" ? run : null);
  const t = convThread(view);
  if (t) return t.busy && t.sessionId ? live({ kind: "thread", t, session: t.sessionId }) : null;
  if (view.startsWith("c:")) return CH.busy(view) ? live({ kind: "chat", session: view.slice(2) }) : null;
  if (view === "chats") return null;
  const chat = chatOf(view);
  const sid = chat && world.act.coordinatorBusy ? world.act.coordinatorBusy(chat) : null;
  return sid ? live({ kind: "coord", conv: view, session: sid }) : null;
}
function sendRender(K = MK) {
  const btn = K.send;
  const files = filesHere(K.view);
  const empty = !K.say.value.replace(/(^|\s)@[\w.-]+/, "").trim() && !files.count;
  const run = empty ? running(K.view) : null;
  const mode = run ? "stop" : "send";
  if (btn.dataset.mode !== mode) {
    btn.dataset.mode = mode;
    redraw(btn, run ? STOP_ICON : ICON.send); // the icon changes in place: a press on it still clicks
    btn.classList.toggle("is-stop", !!run);
  }
  btn.disabled = !run && (empty || !!liveBlock(K.view, K.say.value) || files.busy || files.failed);
  const wait = files.busy ? "Waiting for the files to upload" : files.failed ? "A file didn't upload: retry or remove it" : "";
  btn.setAttribute("aria-label", run ? (run.kind === "coord" ? "Stop the reply" : "Stop this run") : wait ? `Send · ${wait}` : "Send");
  btn.title = run ? (run.kind === "coord" ? "Stop the coordinator" : "Stop the agent (it keeps what's done)") : wait || "Send (Enter)";
}
/** A chip that only says (an open chat's model or mode): no popup to promise, nothing to press. */
function fixChip(el, on) {
  el.classList.toggle("is-fixed", on);
  if (on) { el.setAttribute("aria-disabled", "true"); el.removeAttribute("aria-haspopup"); }
  else { el.removeAttribute("aria-disabled"); el.setAttribute("aria-haspopup", "dialog"); }
}
/** A chat's line above the composer and its Send now toggle, which follow the chat's own state. */
function chatTargetRender() {
  sendNowRender();
  const perm = $("#cs-perm"), ph = CH.isChats(S.view) && !liveBlock() ? CH.permHtml(S.view) : "";
  perm.hidden = !ph;
  perm.title = CH.permTitle(S.view);
  fixChip(perm, S.view !== "chats");
  if (perm._h !== ph) { perm.innerHTML = ph; perm._h = ph; }
  if (!CH.isChats(S.view)) { $("#target").hidden = false; return false; }
  // an ended chat says so in its own words; "paused" would promise it comes back
  const html = CH.blocked(S.view) ? CH.targetHtml(S.view) : liveBlock() ? `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(liveBlock())}</span>` : CH.targetHtml(S.view);
  if ($("#target")._h !== html) { $("#target").innerHTML = html; $("#target")._h = html; }
  $("#target").hidden = !html;
  $("#target").title = S.view === "chats" ? "The folder a new chat works in" : "";
  return true;
}
/**
 * The line above the composer: where this message goes, or why it can't go yet. It follows the world,
 * not only the keyboard: render() calls it too, so a cold Home never keeps saying "Sending is paused ·
 * Connecting to XO…" once everything has loaded (design-research/2026-11-vision/audit E4).
 */
function targetLineRender(K = MK) {
  const tg = targetOf(K.say.value, world.state.projects);
  const pid = tg.pid;
  const t = convThread(K.view);
  const block = liveBlock(K.view, K.say.value);
  let html;
  if (block) html = `<span class="tg-warn">${ICON.pause}</span><span>Sending is paused · ${esc(block)}</span>`;
  else if (pid === "workspace") html = `${ICON.arrow}<span><span class="tg-w">To the </span><b>Workspace</b><span class="tg-w"> coordinator</span></span>`;
  else if (pid) html = `${ICON.arrow}<span>New work for <b>${esc(PROJ(pid))}</b></span>`;
  else if (t) html = threadTargetHtml(t);
  else if (K.view === "ws" || K.view === "home") html = `${ICON.arrow}<span><span class="tg-w">To the </span><b>Workspace</b><span class="tg-w"> coordinator</span></span><span class="muted">· @ to aim at a project</span>`;
  else html = `${ICON.arrow}<span><span class="tg-w">To the </span><b>${esc(PROJ(convProject(K.view)))}</b><span class="tg-w"> coordinator</span></span>`;
  if (K.target._h !== html) { K.target.innerHTML = html; K.target._h = html; }
  K.target.title = "Aim at a project (@)";
}
function updateComposer(K = MK) {
  if (!K.main) {
    trayRender(K); chipRender(false, K);
    targetLineRender(K); syncPlaceholder(K);
    K.form.classList.toggle("has-text", !!K.say.value);
    sendRender(K); growSay(K);
    if (document.activeElement === K.say) atRender(K); else atClose(K);
    return;
  }
  trayRender();
  lrefRender();
  if (chatTargetRender()) {
    syncPlaceholder();
    $("#composer").classList.toggle("has-text", !!say.value);
    sendRender(); growSay(); atClose();
    return;
  }
  targetLineRender();
  // the line above the composer follows where the draft goes (an @ typed in a thread, or taken away): drawn again
  // with the next render when that changes, so it says what the gate does
  { const dk = JSON.stringify(connDest()); if (dk !== updateComposer.dk) { updateComposer.dk = dk; schedule(); } }
  syncPlaceholder();
  $("#composer").classList.toggle("has-text", !!say.value);
  sendRender();
  growSay();
  atRender(MK);
}
/** A composer's @ list: the projects matching the @word at its caret. */
function atRender(K) {
  const at = K.at, pre = K.main ? "at" : "tat", before = K.say.value.slice(0, K.say.selectionStart);
  const m = before.match(/(^|\s)@([\w.-]*)$/);
  // no @ at the caret, or the list was shut here with Escape (until the text or the caret moves): closed
  if (!m || at._shut === before) { atClose(K); return; }
  at._shut = null;
  const q = m[2].toLowerCase();
  const opts = projects().filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  if (!opts.length) { atClose(K); return; }
  at._sel = Math.min(at._sel || 0, opts.length - 1);
  at.innerHTML = opts.map((p, i) => {
    const w = world.state.threads.filter((x) => x.project === p.id && isBusy(x)).length;
    return `<li role="option" id="${pre}-${i}" data-pid="${esc(p.id)}" aria-selected="${i === at._sel}"><span class="at-ic" aria-hidden="true">${projectIcon(p.id)}</span>@${esc(p.id)}<span class="at-s">${w ? `${w} working` : "quiet"}</span></li>`;
  }).join("");
  if (at.hidden) at.style.setProperty("--at-room", `${Math.round(K.form.getBoundingClientRect().top)}px`);
  at.hidden = false;
  const li = at.children[at._sel];
  // the keyboard's row stays in view inside the list's own scroll (never scrollIntoView: it would move the chat too)
  if (li.offsetTop < at.scrollTop) at.scrollTop = li.offsetTop;
  else if (li.offsetTop + li.offsetHeight > at.scrollTop + at.clientHeight) at.scrollTop = li.offsetTop + li.offsetHeight - at.clientHeight;
  K.say.setAttribute("aria-expanded", "true");
  K.say.setAttribute("aria-activedescendant", `${pre}-${at._sel}`);
}
/** The composer's placeholder follows the view, and a resolved thread says a reply reopens it. */
function syncPlaceholder(K = MK) {
  if (CH.isChats(K.view)) { const ph = CH.placeholder(K.view); if (K.say.placeholder !== ph) { K.say.placeholder = ph; K.label.textContent = ph; } return; }
  const t = convThread(K.view), pid = convProject(K.view);
  // (a thread that isn't here has no project to name: its composer isn't drawn, and its label says only "Message")
  const ph = t ? (t.state === "resolved" ? "Reply to reopen it…" : t.frozen ? "Write here to pick this thread back up…" : "Reply to the agent…") : K.view === "home" ? (PHONE.matches ? "What should get done?" : "What should get done? Use @project to aim it") : K.view === "ws" ? "Ask anything across your projects…" : pid ? `Message ${PROJ(pid)}…` : "Message";
  if (K.say.placeholder !== ph) { K.say.placeholder = ph; K.label.textContent = ph; }
}
/** The @ list closed, and the field's accessible state with it (no longer expanded, no active option): one
 *  operation, so what's seen and what's announced always agree (Astra H24). */
function atClose(K = MK) {
  K.at.hidden = true;
  if (K.say.getAttribute("aria-expanded") !== "false") K.say.setAttribute("aria-expanded", "false");
  K.say.removeAttribute("aria-activedescendant");
}
/**
 * The recipient chosen from the @ list: the whole @token at the caret (the part after it too) becomes @pid, one
 * space after it, and the draft is saved at once: who it goes to is part of the draft, so a reload keeps it
 * (Astra H27: it fell back to the Workspace).
 */
function pickAt(pid, K = MK) {
  const f = K.say, pos = f.selectionStart;
  const before = f.value.slice(0, pos).replace(/(^|\s)@([\w.-]*)$/, `$1@${pid}`);
  const after = f.value.slice(pos).replace(/^[\w.-]*/, "");
  f.value = before + (/^\s/.test(after) ? "" : " ") + after;
  f.setSelectionRange(before.length + 1, before.length + 1);
  K.at._sel = 0; K.at._shut = null;
  saveDraft(K);
  updateComposer(K); f.focus();
}
function saveDraft(K = MK) { const v = K.view; if (K.say.value) S.drafts[v] = K.say.value; else delete S.drafts[v]; store.set(DRAFTS, S.drafts); }
function loadDraft(K = MK) { K.say.value = S.drafts[K.view] || ""; K.at._sel = 0; updateComposer(K); }

say.addEventListener("input", () => { atList._sel = 0; updateComposer(); saveDraft(); });
say.addEventListener("click", () => updateComposer());
say.addEventListener("keydown", (e) => {
  // an IME composing (its Enter commits the words, its arrows walk its candidates, its Escape cancels them) owns
  // every key: neither the @ list, nor Send, nor the page's own keys take them (Astra H25: a composing Enter chose
  // a recipient; a composing Escape would have left the thread)
  if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
  if (atKeys(e, MK)) return;
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); say.blur(); }
});
/** The open @ list owns the arrows, Enter and Tab (they choose, never send; Shift+Enter is still a new line) and Escape. */
function atKeys(e, K) {
  const at = K.at;
  if (at.hidden) return false;
  const n = at.children.length;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); at._sel = (at._sel + (e.key === "ArrowDown" ? 1 : n - 1)) % n; updateComposer(K); return true; }
  if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") { e.preventDefault(); pickAt(at.children[at._sel].dataset.pid, K); return true; }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); atShut(K); return true; }
  return false;
}
/** Escape on an open @ list: it stays shut there until the text or the caret moves. */
function atShut(K) { K.at._shut = K.say.value.slice(0, K.say.selectionStart); atClose(K); }
function wireAt(K) {
  const at = K.at;
  at.addEventListener("mousedown", (e) => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pickAt(li.dataset.pid, K); } });
  // the row under a moving mouse is the active one, as the arrows make it (Jump's model): one row looks active, Enter
  // picks it and the arrows go on from it (Astra C058 on 517af1c: hover painted a second row; Enter took the first)
  at.addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const li = e.target.closest("li[role=option]"), i = li ? [...at.children].indexOf(li) : -1;
    if (i < 0 || i === at._sel) return;
    at.querySelector('[aria-selected="true"]')?.setAttribute("aria-selected", "false");
    at._sel = i; li.setAttribute("aria-selected", "true");
    K.say.setAttribute("aria-activedescendant", li.id);
  });
}
wireAt(MK);
// On Home an empty composer shrinks when it loses focus, which drops the dock (and the herald just above it)
// 45 px under the pointer, so the click lands on nothing. Keep its shape from the press until the click.
{
  const comp = $("#composer");
  let timer = 0;
  const release = (ms) => { clearTimeout(timer); timer = setTimeout(() => comp.classList.remove("held"), ms); };
  document.addEventListener("pointerdown", (e) => {
    if (!comp.contains(document.activeElement) || comp.contains(e.target)) return;
    clearTimeout(timer);
    comp.classList.add("held");
  }, true);
  // a touch's click can come a moment after the finger lifts, so wait for it (or give up shortly after)
  document.addEventListener("pointerup", () => { if (comp.classList.contains("held")) release(600); }, true);
  document.addEventListener("pointercancel", () => { if (comp.classList.contains("held")) release(0); }, true);
  document.addEventListener("click", () => { if (comp.classList.contains("held")) release(0); }, true);
}
$("#composer").addEventListener("submit", (e) => { e.preventDefault(); if ($("#send").dataset.mode === "stop") stopRun(); else send(); });
$("#target").addEventListener("click", () => {
  if (S.view === "chats") { CH.toggleSetup($("#target"), "cwd"); updateComposer(); return; }
  if (S.view.startsWith("c:")) { say.focus(); return; }
  aimAt(MK);
});
/** The target line pressed: the chooser opens on the recipient the draft already names, wherever it is, with every
 *  project listed and that one active (Astra H26); with none, on a new @ at the start. The draft is saved as it reads. */
function aimAt(K) {
  const f = K.say, tok = /(^|\s)@([\w.-]*)/.exec(f.value);
  let at = 1;
  if (tok) {
    at = tok.index + tok[1].length + 1;
    K.at._sel = Math.max(0, projects().findIndex((p) => p.id.toLowerCase() === tok[2].toLowerCase()));
  } else { f.value = "@" + (f.value ? " " + f.value : ""); K.at._sel = 0; saveDraft(K); }
  K.at._shut = null;
  f.focus(); f.setSelectionRange(at, at); updateComposer(K);
}
/** "Send now": its own toggle, shown in a chat whose turn is running where the agent can be interrupted. */
function sendNowRender() {
  const b = $("#send-now");
  const st = CH.isChats(S.view) && !liveBlock() ? CH.nowState(S.view) : null;
  b.hidden = !st;
  if (st) { b.setAttribute("aria-pressed", String(st.on)); b.classList.toggle("is-on", st.on); }
}
$("#cs-perm").addEventListener("click", () => { if (S.view !== "chats") return; CH.toggleSetup($("#cs-perm"), "mode"); updateComposer(); });
$("#send-now").addEventListener("click", () => { CH.toggleNow(S.view); updateComposer(); say.focus(); });
$("#iq").addEventListener("click", () => {
  if (S.view === "chats") { CH.toggleSetup($("#iq"), "model"); updateComposer(); return; }
  if (CH.isChats(S.view)) return;
  toggleIq(sessionOf(S.view), $("#iq"));
});
// one picker for every composer: its chip opens it and closes it, in the main chat or a thread in the panel
function toggleIq(sid, chip) { if (IQ.isOpen) IQ.close(); else IQ.open(sid, chip); }

/**
 * Live Stop: nothing is sent for 3 s (Undo), then the session's turn and its sub-agents stop at once
 * (POST /api/chat/abort). The turn's own record then says what ran: "Stopped after …".
 */
function stopLive(run, { interrupt = false, runs = 0 } = {}) {
  const what = run.kind === "thread" ? run.t.title : run.kind === "chat" ? "This chat" : run.conv === "ws" ? "The coordinator" : `${PROJ(chatOf(run.conv))} coordinator`;
  // the turn you chose to stop: if it ends inside the window and another starts, that one is left alone
  const token = { session: run.session, turn: world.act.turnOf(run.session), what, interrupt, until: Date.now() + Kit.COMMIT_MS, cancelled: false, sent: false };
  S.stops.set(run.session, token);
  stopsHerald();
  const also = runs ? ` and its ${runs} sub-agent${runs === 1 ? "" : "s"}` : "";
  announce(interrupt ? `Interrupting ${what}${also} in 3 seconds, so it reads your message next. Undo to let it finish.` : `Stopping ${what} in 3 seconds. Undo to keep it working.`);
  sound.play("back");
  schedule();
  setTimeout(async () => {
    if (token.cancelled) return;
    token.sent = true;
    stopsHerald();
    const now = world.act.turnOf(token.session);
    if (token.turn && now !== token.turn) {
      S.stops.delete(token.session);
      if (interrupt) {
        // its next turn is the one that reads your message
        heraldShow({ kind: "halt", text: "It had already finished", sub: `${what} · it reads your message next` }, 4200);
        announce("It had already finished that turn. It reads your message next.");
        schedule();
        return;
      }
      heraldShow({ kind: "halt", text: "It had already finished", sub: now ? `${what} · its next turn goes on` : what }, 4200);
      announce(now ? "It had already finished that turn. The next one goes on; Stop again to end it." : "It had already finished.");
      schedule();
      return;
    }
    try {
      const r = await world.act.stop(token.session);
      const done = r && r.stopped === false;
      if (interrupt) {
        heraldShow({ kind: "halt", text: done ? "It had already finished" : "Interrupted", sub: `${what} · it reads your message next` }, 4200);
        announce(done ? "It had already finished. It reads your message next." : `Interrupted ${what}. What it did is kept, and it reads your message next.`);
      } else {
        heraldShow({ kind: "halt", text: done ? "It had already finished" : "Stopped", sub: done ? what : `${what} · what it did is kept` }, 4200);
        announce(done ? "It had already finished." : `Stopped ${what}. What it did is kept.`);
      }
    } catch (err) {
      // Retry stops the same session, wherever you are when you press it
      heraldShow({ kind: "stopped", text: interrupt ? "Couldn't interrupt it" : "Couldn't stop it", sub: `${what} · ${err.message}`, undo: () => stopLive(run, { interrupt, runs }), undoLabel: "Retry", back: interrupt ? [inUse("[data-interrupt]"), inUse("#send")] : [inUse("[data-chat-stop]"), inUse("#send")] }, 7000);
    } finally {
      if (S.stops.get(token.session) === token) S.stops.delete(token.session);
      schedule();
    }
  }, Kit.COMMIT_MS);
}
/**
 * One line for every stop still in its Undo window, a turn's (S.stops) or a sub-agent's (pendingStops),
 * with one Undo for all: a second stop never hides the first one's Undo.
 */
function stopsHerald() {
  const turns = [...S.stops.values()].filter((x) => !x.cancelled && !x.sent);
  const runs = pendingStops.filter((j) => !j.cancelled && !j.sent);
  const all = [...turns, ...runs];
  if (!all.length) { if (S.herald && S.herald.tag === "stops") { S.herald.until = 0; heraldNext(); } return; }
  const last = Math.max(...all.map((x) => x.until));
  heraldShow({ kind: "halt", tag: "stops", text: all.every((x) => x.interrupt) ? "Interrupting" : "Stopping", sub: all.map((x) => x.what).join(", "), back: all.every((x) => x.interrupt) ? [inUse("[data-interrupt]"), inUse("#send")] : [inUse("[data-chat-stop]"), inUse("#send")], undo: () => {
    for (const x of turns) { x.cancelled = true; if (S.stops.get(x.session) === x) S.stops.delete(x.session); }
    for (const j of runs) { j.cancelled = true; const i = pendingStops.indexOf(j); if (i >= 0) pendingStops.splice(i, 1); }
    announce(all.length > 1 ? "Not stopped. They keep working." : "Not stopped. It keeps working.");
    schedule();
  } }, Math.max(300, last - Date.now()));
}

/** Stop: the run halts honestly; what's done is kept and said so. */
function stopRun(view = S.view) {
  const run = running(view);
  if (run) stopLive(run);
}
/**
 * Interrupt: the same Stop, from your message that waits for the turn to end. Storm runs that
 * message as the agent's next turn once the stopped one ends; a thread message has no "send now".
 */
function interruptRun(view = S.view) {
  const run = running(view);
  if (run && run.kind === "thread") stopLive(run, { interrupt: true, runs: workingRuns(run.t) });
}


/** Why sending is paused right now, or "" (classic composerBlock, in plain words). */
function liveBlock(view = S.view, text = say.value) {
  if (CH.isChats(view)) return CH.blocked(view) || sendBlock(world.state, { timeline: false });
  return blockFor(composerDest(view, text));
}
/** The one send gate: why a message to this destination can't go right now, or "". dest: { thread: true } (a reply
 *  in a thread, which xo-space never routes) or { pid } (a new message to that chat's timeline: refused when its
 *  routing is off). Every send path names where its message actually goes (Launchpad grader on 652ed3d: Retry and
 *  the file actions asked about the composer's draft instead). */
function blockFor(dest) {
  return sendBlock(world.state, { timeline: !dest.thread, pid: dest.thread ? null : dest.pid || "workspace" });
}
/** A send the gate refused, before it went: said, and shown where the person is, as a message that didn't go
 *  (js/herald.js refusedNotice). Every refused path comes here: the composer, Chats, a Retry, a file's Tell and Ask
 *  about this (the controls grader on d79d37e, S137: the refusal was only read out; the screen didn't change). */
function refuse(block, kept = "your words are kept") {
  announce(`Not sent: ${block}. ${kept[0].toUpperCase()}${kept.slice(1)}.`);
  heraldShow(refusedNotice(block, kept), 6000);
}
/** The line above the composer asks what the gate asks (connLine and blockFor: one rule) */
function connDest() { const d = composerDest(); return d.thread ? { thread: true } : { pid: d.pid }; }
/** Where the composer's draft goes, as sendLive sends it: this thread, unless it names a project; else the named
 *  project's chat, or this place's. */
function composerDest(view = S.view, text = say.value) {
  if (CH.isChats(view)) return { thread: true }; // a plain chat's message is never routed (as liveBlock sends it)
  const tg = targetOf(text, world.state.projects), t = convThread(view);
  return t && !tg.pid ? { thread: true } : { pid: tg.pid || chatOf(view) || "workspace" };
}

function sendLive(raw, K = MK) {
  const block = liveBlock(K.view, K.say.value);
  if (block) { refuse(block, "your text is kept"); return; }
  const tg = targetOf(raw, world.state.projects);
  let text = stripTarget(raw, tg.token);
  const files = filesHere(K.view);
  if (!text && !files.count) return;
  if (files.busy) { announce("Not sent yet: waiting for the files to upload."); return; }
  if (files.failed) { announce("Not sent: a file didn't upload. Retry or remove it first."); return; }
  const t = convThread(K.view);
  const thread = t && !tg.pid ? t : null;
  const chat = thread ? t.project : tg.pid || chatOf(K.view) || "workspace";
  const conv = thread ? K.view : convOfChat(chat);
  const here = conv === K.view;
  // the lines a message is about (a file beside the chat): "path:a-b", then the words, as Ask about lines sends
  const ref = here && S.lref[conv];
  if (ref && text) { text = `${ref.a ? `${ref.path}:${ref.a}${ref.b > ref.a ? `-${ref.b}` : ""}` : `File: ${ref.path}`}\n\n${text}`; delete S.lref[conv]; }
  // client_id: a retry of this exact message is the same request, so the server stores it once (UI-reference §0.7)
  const m = { id: `l${++S.n}_${Date.now().toString(36)}`, conv, at: Date.now(), who: "you", text, status: "sending", target: thread ? null : chat, to: thread ? t.title || "the thread" : chat === "workspace" ? "the coordinator" : PROJ(chat), cid: `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
  if (files.count) { m.files = tray.take(K.view); m.files.forEach(dropThumb); }
  (S.local[conv] = S.local[conv] || []).push(m);
  K.say.value = ""; saveDraft(K); updateComposer(K);
  const btn = K.send; btn.classList.remove("fired"); void btn.offsetWidth; btn.classList.add("fired");
  sound.play("send");
  // From Home, what you wrote carries you into the conversation it went to (the Workspace, or the
  // @project's): the bubble rises out of the composer into place, and Back returns to Home. From a
  // conversation, a message aimed elsewhere leaves you where you are and says where it went.
  if (!here && K.view === "home") { go(conv, { carry: true }); K.conv.follow.toLatest(false); arrive(K.conv.msgs.querySelector(`[data-k="${m.id}"]`)); }
  // while it's out it says so; each answer sets this same notice whole (postLive: sent, or not sent; a Retry: out)
  else if (!here) heraldShow(noticeFor(m, "out"), 9000);
  else { render(); K.conv.follow.toLatest(false); arrive(K.conv.msgs.querySelector(`[data-k="${m.id}"]`)); }
  // handing the work back to the agent: the panel's Changes follows it again (the owner's D6)
  if (thread) STAGE.resumeFollow(conv);
  deliverLive(m, thread);
}

/** The server's row replaces the optimistic one (same bubble, never twice); errors keep the text. One request at
 *  a time per message: a Retry pressed again while it's out joins it (js/pending.js). */
function deliverLive(m, thread) { return once(`send:${m.cid}`, () => postLive(m, thread)); }
async function postLive(m, thread) {
  m.status = "sending"; delete m.err;
  // a Retry's attempt: its notice (still "Not sent", on screen or waiting) says it's out again
  heraldFor(m.id, () => noticeFor(m, "out"));
  try {
    const row = await postWithFiles(m, thread);
    m.status = "sent";
    const where = thread ? "the thread" : m.target === "workspace" ? "the coordinator" : PROJ(m.target);
    announce(`Sent to ${where}.`);
    // its own notice says it went: set whole, whatever it said before ("Sending", or "Not sent" before a Retry)
    heraldFor(m.id, () => noticeFor(m, "sent"));
  } catch (err) {
    m.status = "failed";
    m.err = { title: err.fileErr ? `A file didn't upload: ${uploadErrorText(err)}` : err.code === "unknown_attachment" ? "A file is no longer on the server" : sendErrorTitle(err), text: err.message || "" };
    announce(`${m.err.title}. ${m.err.text} Your message is kept; retry or edit it.`);
    // the failure takes the place of its own "Sending to …" notice; else, away from its conversation, it's said
    // anew. Forced: it never yields to a passing notice (behind an Undo it waits its turn). Astra on 83929bb:
    // "Sent to demo" stood over a 503
    const fail = noticeFor(m, "failed");
    if (!heraldFor(m.id, () => fail, 6000) && S.view !== m.conv) heraldShow(fail, 6000);
  }
  schedule();
}

/**
 * Post a message with its files. Each file is uploaded to the chat the message goes to (a message
 * aimed elsewhere with @project takes its files along). If the server no longer knows one (an upload
 * no message named is swept after a day), the same bytes go up again, once.
 */
async function postWithFiles(m, thread) {
  const project = thread ? thread.project : m.target || "workspace";
  const postIt = (attachments) => (thread
    ? world.act.reply(thread.id, m.text, { clientId: m.cid, attachments })
    : world.act.ask(project, m.text, { clientId: m.cid, attachments }));
  if (!m.files || !m.files.length) return postIt();
  const chat = world.act.chatId?.(project);
  const up = (opts) => tray.ensure(m.files, chat, opts).catch((err) => { throw Object.assign(err, { fileErr: true }); });
  try {
    return await postIt(await up());
  } catch (err) {
    if (err.code !== "unknown_attachment") throw err;
    return postIt(await up({ again: true }));
  }
}

/** Send what's in the composer. Pressed on Send itself, focus goes to the composer: Send empties it and is
 *  disabled until you write again, which would leave focus on nothing. */
function send(K = MK) {
  const raw = K.say.value;
  const fromSend = document.activeElement === K.send;
  if (CH.isChats(K.view)) {
    const text = raw.trim();
    if (!text) return;
    const block = liveBlock(K.view, K.say.value);
    if (block) { refuse(block, "your text is kept"); return; }
    K.say.value = ""; saveDraft(K); updateComposer(K);
    sound.play("send");
    CH.send(K.view, text);
  } else sendLive(raw, K);
  if (fromSend && document.activeElement !== K.say && !K.say.value) K.say.focus({ preventScroll: true });
}

/** A failed message sent again: the same request (its client_id), one at a time, so a second press joins the
 *  first. Its Retry goes as it starts: focus, if it was there, goes to the composer. */
function retry(id) {
  for (const list of Object.values(S.local)) {
    const m = list.find((x) => x.id === id);
    if (m) {
      // the message's own destination, never the composer's newer draft: its chat, or its thread
      const block = blockFor(m.target ? { pid: m.target } : { thread: true });
      if (block) { refuse(block, "the message stays, to retry"); return; }
      const had = !!document.activeElement?.closest?.(`[data-retry="${CSS.escape(id)}"]`), K = composerAt(document.activeElement);
      deliverLive(m, convThread(m.conv) && !m.target ? convThread(m.conv) : null);
      schedule();
      if (had) K.say.focus({ preventScroll: true });
      return;
    }
  }
}
/**
 * A message's words back in the composer (Edit on a failed one, a refused new chat): with what you've written
 * since, never instead of it. The words come first, your newer draft under them, and focus is in the composer.
 */
function putBack(text, K = MK) {
  const f = K.say, now = f.value.trim();
  f.value = now ? `${text}\n\n${f.value.replace(/^\s+/, "")}` : text;
  growSay(K); saveDraft(K); updateComposer(K); f.focus();
  f.setSelectionRange(f.value.length, f.value.length);
}
/** A failed message's Edit: its words back in the composer of the conversation it's in (the chat's, or a thread
 *  page's in the panel). */
function editFailed(id, K = MK) {
  const view = K.view;
  const list = S.local[view] || [];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [m] = list.splice(i, 1);
  if (m.files && m.files.length) tray.restore(view, m.files);
  putBack((m.target && m.target !== convProject(view) ? `@${m.target} ` : "") + m.text, K);
  render();
}

// ── The Thread page (P2): a thread in the panel beside the coordinator's chat ────────────────────────────────
// (design-research/2026-11-19-threads-panel/thread-page/THREAD-IN-PANEL.md; the owner chose the proper build, 19 Nov
// 15:20Z.) One page, its key the thread it shows: its title and ⋯ in the panel's head, its facts, checklist,
// conversation (createConv + createFollow + msgx), typing line and composer (wireComposer). It opens from the
// panel's Threads beside a chat; ⌘/Ctrl-click, or Open full width, gives today's full page.
const TP = { box: null, C: null, K: null, tid: null, follow: null, viewSubs: new Set() };
const tpView = () => (TP.tid ? "t:" + TP.tid : "");
function tpMount(box) {
  TP.box = box;
  box.classList.add("tp");
  box.innerHTML = `<header class="tp-head" id="tphead"></header><div class="thead tp-thead" id="tpthead" hidden></div>` +
    `<div class="scroller tp-scroller" id="tscroller" tabindex="-1" data-own-scroll><div class="column" id="tcolumn">` +
    `<div class="msgs" id="tmsgs" role="log" aria-live="off" aria-label="The thread's messages"></div><div class="typing-slot" id="ttyping"></div></div></div>` +
    `<div class="dock tp-dock" id="tpdock"><div class="herald" id="tpherald" aria-live="polite"></div><div class="tdock" id="tptdock"></div><div class="cbar"><form class="composer" id="tpcomposer" autocomplete="off">` +
    `<label class="sr-only" for="tsay" id="tsay-label">Reply</label><ul class="att-tray" id="tatt-tray" aria-label="Files on this reply" hidden></ul>` +
    `<div class="composer-field"><textarea id="tsay" rows="1" placeholder="Reply to the agent…" aria-autocomplete="list" aria-controls="tat-list" aria-expanded="false" spellcheck="true"></textarea><ul id="tat-list" class="at-list" role="listbox" aria-label="Projects" hidden></ul></div>` +
    `<div class="composer-row"><button type="button" class="attach" id="tattach" aria-label="Add files" title="Add files: text, images or PDFs, up to 25 MB each">${ICON.clip}</button><input type="file" id="tatt-input" multiple hidden tabindex="-1" accept="${esc($("#att-input").accept)}">` +
    `<button type="button" class="target" id="ttarget" title="Aim at a project (@)"></button><button type="button" class="iq" id="tiq" aria-haspopup="dialog" aria-expanded="false"></button><button type="submit" class="send" id="tsend" aria-label="Send" title="Send (Enter)" disabled></button></div>` +
    `<p class="att-note" id="tatt-note" hidden>Files are kept in the project's <code>.xo/</code> folder. Unlike chat text, they aren't scrubbed for secrets.</p></form></div></div>`;
  const els = { scroller: $("#tscroller"), column: $("#tcolumn"), msgs: $("#tmsgs"), dock: $("#tpdock") };
  TP.follow = createFollow(els);
  TP.follow.init();
  TP.C = createConv({ view: tpView, msgs: els.msgs, scroller: els.scroller, column: els.column, typing: $("#ttyping"), follow: TP.follow });
  TP.K = { main: false, get view() { return tpView(); }, say: $("#tsay"), send: $("#tsend"), form: $("#tpcomposer"), target: $("#ttarget"), label: $("#tsay-label"), conv: TP.C,
    tray: $("#tatt-tray"), attach: $("#tattach"), input: $("#tatt-input"), note: $("#tatt-note"), iq: $("#tiq"), at: $("#tat-list") };
  wireComposer(TP.K);
  wireTray(TP.K);
  TP.dock = createDock({ el: $("#tptdock"), view: tpView, region: () => TP.C.scroller });
  // its ⋯ lives in the panel's head
  const acts = document.createElement("span");
  acts.className = "tp-acts"; acts.id = "tpacts"; acts.dataset.for = "thread";
  STAGE.slot.append(acts);
  menuKeys(acts, { close: () => closeThreadMenu() });
  // its files: the paperclip; a drop on the page is the app's one drop, into this composer
  TP.K.attach.addEventListener("click", () => TP.K.input.click());
  TP.K.input.addEventListener("change", () => { addFiles(TP.K.input.files, TP.K); TP.K.input.value = ""; });
  // its model and effort: the thread's own session, the chat's picker
  TP.K.iq.addEventListener("click", () => toggleIq(sessionOf(tpView()), TP.K.iq));
  TP.deco = decorateConversation({ conv: box, msgs: els.msgs, scroller: els.scroller, typing: $("#ttyping"), composer: TP.K.form, say: TP.K.say, send: TP.K.send, atList: TP.K.at,
    dock: els.dock, tdock: $("#tptdock"), herald: $("#tpherald"), host: box, project: () => convProject(tpView()), follow: TP.follow, isThread: () => true, view: tpView, onView: (fn) => TP.viewSubs.add(fn) });
  // the composer's height is the conversation's room at its foot (as #app's --dock-h is the main chat's)
  TP.dockRO = watchDock(els.dock, box);
  conversationGestures({ scroller: els.scroller, msgs: els.msgs, say: TP.K.say, toast: (text) => toastLine(text) });
  els.scroller.addEventListener("scroll", () => { if (!TP.scrollRaf) TP.scrollRaf = requestAnimationFrame(() => { TP.scrollRaf = 0; loadAhead(TP.C); }); }, { passive: true });
}
function tpShow(key, { focus = false } = {}) {
  if (TP.tid !== key) {
    returnPill(null);
    if (TP.tid && TP.K) saveDraft(TP.K);
    TP.tid = key;
    TP.C.rendered = null; TP.C.filled = null;
    TP.C.msgs.replaceChildren(); $("#tpthead").hidden = true;
    TP.dock.reset();
    world.act.watchSideThread?.(key);
    loadDraft(TP.K);
    TP.viewSubs.forEach((fn) => fn());
    // drawn after the first frame, so the slide starts at the press
    const t = convThread(tpView());
    if (t) tpHead(t);
    TP.wait = true;
    requestAnimationFrame(() => setTimeout(() => {
      TP.wait = false;
      if (TP.tid === key && STAGE.pageShown?.name === "thread") drawThreadPage(D.needItems());
      if (focus && TP.tid === key) TP.K.say.focus({ preventScroll: true });
    }, 0));
    return;
  }
  drawThreadPage(D.needItems());
  if (focus) requestAnimationFrame(() => TP.K.say.focus({ preventScroll: true }));
}
// the page closes: its draft is kept, its parts stay built
function tpClose() {
  if (TP.K && TP.tid) saveDraft(TP.K);
  if (S.tMenuIn === "page") { S.tMenu = null; S.tMenuIn = null; }
  world.act.watchSideThread?.(null);
  TP.tid = null;
}
STAGE.page("thread", {
  title: (key) => world.thread(key)?.title || "Thread",
  mount: (box) => tpMount(box),
  onShow: (key, o) => tpShow(key, o),
  // a reply being written is kept (its draft), so closing never loses it: nothing to ask
  close: () => tpClose(),
  // Esc in its composer leaves the field first (the draft stays); the next Esc goes back to the sections
  escape: () => { if (S.tMenu && S.tMenuIn === "page") { closeThreadMenu(); return true; }
    if (TP.K && document.activeElement === TP.K.say && !TP.K.at.hidden) { atShut(TP.K); return true; }
    if (TP.K && document.activeElement === TP.K.say) { TP.K.say.blur(); TP.C.scroller.focus({ preventScroll: true }); return true; } return false; },
});
// its facts under the panel's head, its ⋯ in it
function tpHead(t) {
  const head = $("#tphead"), acts = $("#tpacts");
  const open = S.tMenu === t.id && S.tMenuIn === "page";
  const html = `<button type="button" class="stg-btn tp-main" data-tp-main="${esc(t.id)}" title="Open in main chat" aria-label="Open in main chat">${ICON.toMain}</button><span class="badge st-${stOf(t)}">${stateMark(glyphOf(t))}${isHeld(t) ? heldBadge(t.held) : wordOf(t)}</span>` +
    `${rtTag(t)}${t.branch ? `<code class="tp-br" title="${esc(t.branch)}">${ICON.branch}${esc(t.branch)}</code>` : ""}`;
  const menu = `<span class="tp-menu-w"><button type="button" class="stg-ic tw-more" data-tmenu="${esc(t.id)}" data-tmenu-in="page" aria-haspopup="menu" aria-expanded="${open}" title="Everything this thread can do" aria-label="Thread actions">${ICON.more}</button>${open ? threadMenuHtml(t, "page") : ""}</span>`;
  if (head._h !== html + menu) { redraw(head, html); redraw(acts, menu); head._h = html + menu; }
}
function drawThreadPage(needs) {
  const t = convThread(tpView());
  if (!t) { STAGE.closePage("thread"); return; } // a thread that's gone (deleted, resolved away) leaves the panel
  tpHead(t);
  checklistRender(needs, $("#tpthead"), tpView(), "tck-list");
  drawConv(TP.C, needs);
  TP.dock.render(needs); // the chat's own dock, over its own element: its card, fold, Undo
  if (document.activeElement !== TP.K.say) updateComposer(TP.K); else { sendRender(TP.K); targetLineRender(TP.K); }
}
// the thread moves from the panel into the main chat: its frame snaps across while the panel steps back without its copy
function toMain(id) {
  closeThreadMenu({ focus: false });
  STAGE.closePage("thread"); go("t:" + id, { panel: true });
}
document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-tp-main]"); if (b) toMain(b.dataset.tpMain); });
/**
 * A thread asked for from the panel (its Threads rows): beside a chat (a project's or the Workspace's) it opens as
 * the panel's Thread page; ⌘/Ctrl-click, anywhere else (Home, Artifacts, another thread's page), or the thread
 * already in the main chat, it goes there as today.
 */
function openFromPanel(v, e) {
  const besideChat = S.view === "ws" || S.view.startsWith("p:"), msg = e?.target?.closest?.("[data-go]")?.dataset.goMsg;
  if (v && v.startsWith("t:") && besideChat && !(e && (e.metaKey || e.ctrlKey)) && world.thread(v.slice(2))) { STAGE.show("thread", v.slice(2), { focus: true }); if (msg) showMsg(msg, TP.C); return; }
  go(v, { panel: true });
  if (msg) showMsg(msg);
}

// ── render ──────────────────────────────────────────────────────────────────
const scroller = $("#scroller"), msgsEl = $("#msgs");
/**
 * A conversation on screen (P1 of a thread beside the coordinator's chat, design-research/2026-11-19-threads-panel/
 * thread-page): its view, its own elements (messages, scroller, column, typing line) and its follower, and what
 * its drawing remembers (rendered, filled). The main chat (#conv) is MAIN, its view always S.view; the panel's
 * thread page makes its own. drawConv(C, needs) draws one.
 */
function createConv({ view, msgs, scroller: sc, column, typing, follow, main = false }) {
  return { get view() { return typeof view === "function" ? view() : view; }, msgs, scroller: sc, column, typing, follow, main, rendered: null, filled: null };
}
const MAIN = createConv({ view: () => S.view, msgs: msgsEl, scroller, column: $("#column"), typing: $("#typing"), main: true,
  follow: { toLatest, toTop, unpin, isPinned, fromTop, toRow, fromLatest } });
// the oldest message on screen; day lines don't count, since older messages of the same day land below theirs
const FIRST_MSG = "[data-k]:not([data-k=hist]):not([data-k=note]):not([data-k^='day|'])";
let rendered = null, raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
// Where the view is has one owner, js/follow.js (QA #9): pinned at the latest, or reading where you are.
// Here: opening a conversation goes to the latest; a redraw while you read puts what you read back where it
// stood (holdPlace). The browser's scroll anchoring usually has, so nothing is written; it can't when the
// row you're reading is itself redrawn (a thread's first fill redraws most of them), or has none (Safari).

function render() {
  if (!world.state.loaded) return;
  const needs = D.needItems();
  pings(needs);
  const v = S.view;
  const isHome = v === "home";
  const isArts = v === "artifacts", isLp = v === "launchpad", isPage = !!PAGE_OF[v];
  // written only when they change: every write is a mutation other layers react to. data-conv names the
  // conversation itself (its id), so nothing has to infer "a new conversation opened" from what's on screen
  const appEl = $("#app"), kind = isPage ? v : v === "ws" ? "ws" : v.startsWith("t:") || v.startsWith("c:") ? "thread" : "project";
  if (appEl.dataset.view !== kind) appEl.dataset.view = kind;
  if (appEl.dataset.conv !== v) appEl.dataset.conv = v;
  dockAtTop(v === "chats");
  // a thread that isn't here (gone with a reset, or a link older than this Space) offers no message box: there's
  // nothing to write to (the create-project grader on 131d146: its composer stayed, "Message undefined…")
  const gone = v.startsWith("t:") && !convThread(v);
  if (appEl.hasAttribute("data-gone") !== gone) appEl.toggleAttribute("data-gone", gone);
  for (const [k, sel] of Object.entries(PAGE_OF)) $(sel).hidden = k !== v;
  $("#conv").hidden = isPage;
  const pbt = isHome ? "Home" : isArts ? "Artifacts" : isLp ? "Launchpad" : "";
  if ($("#pb-t")._h !== pbt + v) { $("#pb-t").innerHTML = pbt ? esc(pbt) : XO; $("#pb-t")._h = pbt + v; }
  sideRender(needs);
  if (isHome) { homeRender(needs); rendered = MAIN.rendered = "home"; }
  else if (isArts) { REC.artifacts.render(); rendered = MAIN.rendered = "artifacts"; }
  else if (isLp) { LPP.render(); rendered = MAIN.rendered = "launchpad"; }
  else {
    topRender(needs);
    wsHeadRender(needs);
    drawConv(MAIN, needs);
    rendered = MAIN.rendered;
    // focus in the composer as it goes with its thread: to Go to Home, else the conversation, never the page
    if (gone && document.activeElement === say) ([...msgsEl.querySelectorAll('.calm-act [data-go="home"]')].find(usable) || placeRegion()).focus({ preventScroll: true });
  }
  if (!isPage) requestAnimationFrame(() => loadAhead(MAIN));
  if (TP.C && TP.tid && !TP.wait && STAGE.pageShown?.name === "thread") drawThreadPage(needs);
  dockRender(needs);
  heraldRender(needs);
  // the line above the composer follows the world on every view: a thread's follows its agent's turn
  // (F7) unless you are aiming the message elsewhere, and a paused line clears the moment it stops
  // being true (a cold Home used to keep "Connecting to XO…" until you typed)
  if (!chatTargetRender()) targetLineRender();
  syncPlaceholder();
  sendRender();
  chipRender();
  D.sync();
  MAP.render(v);
  VW.notice();
  STAGE.sync();
  LW.sync();
  FP.sync();
  const nd = needs.filter((n) => n.admitted && !n.later).length;
  document.title = Kit.titleFor(nd, "XO Space");
  faviconRender(world.state.threads.filter(isBusy).sort((a, b) => b.lastAt - a.lastAt)[0] || null, nd > 0);
  // a control that asked for focus to land on what this draw makes (Interrupt → its Undo, Undo → Interrupt
  // again): its named destination, once, in the same step as the draw that took the control away
  if (S.focusNext) { const to = S.focusNext.map((sel) => (typeof sel === "function" ? sel() : $(sel))).find(usable); S.focusNext = null; to?.focus({ preventScroll: true }); }
}
/** Where you carry on when the control you were on goes and nothing more particular is named: the place's own
 *  region (Home, Artifacts, else the conversation). */
const placeRegion = () => pageEl(S.view) || scroller;
/**
 * The progress line, XO's one motif, in the browser tab too. While an agent works, the mark carries the
 * latest working thread's own steps along its foot (green done, blue the step it's on, grey to do), the
 * same line as in its header; with no checklist, one blue line. When nothing works, the plain mark.
 * While something truly needs you (the same count the title says), the line is one amber line instead: that
 * is what a glance at the tab is for. A line, never a dot, never a badge that counts up.
 */
const FAVICON = { key: null, plain: null };
function faviconRender(t, need = false) {
  const c = !need && t && t.checklist;
  const n = c && c.total ? Math.min(c.total, 6) : 0;
  const done = n ? Math.min(n, Math.round((c.done / c.total) * n)) : 0;
  const key = need ? "need" : t ? `${n}:${done}` : "";
  if (FAVICON.key === key) return;
  FAVICON.key = key;
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  if (FAVICON.plain == null) FAVICON.plain = link.getAttribute("href");
  if (!t && !need) { link.setAttribute("href", FAVICON.plain); return; }
  // the owner's favicon-progress (assets/icons/xo/g-app-icon): the mark raised 5, the line on its foot, 48 grid
  const W = 28.5, X = 9.75, GAP = 1.5, k = n || 1, w = (W - GAP * (k - 1)) / k;
  const fill = (i) => (need ? "#F5A623" : !n ? "#75ADF1" : i < done ? "#83D63A" : i === done ? "#75ADF1" : "#4A4A4A");
  const seg = Array.from({ length: k }, (_, i) => `<rect x="${(X + i * (w + GAP)).toFixed(2)}" y="35" width="${w.toFixed(2)}" height="2.5" rx="1.25" fill="${fill(i)}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="#151515"/><path d="M10.4 13.8l5.2 5.2-5.2 5.2M23.2 13.8L18 19l5.2 5.2" fill="none" stroke-width="3" stroke="#E1E1E1"/><path d="M32 13.8L26.8 19l5.2 5.2M34.4 13.8l5.2 5.2-5.2 5.2" fill="none" stroke-width="3" stroke="#83D63A"/>${seg}</svg>`;
  link.setAttribute("href", `data:image/svg+xml,${encodeURIComponent(svg)}`);
}
/** Earlier messages load before you reach them (hub #28). Within about a screen of the top, the next
 *  page is fetched, and it lands above what you're reading without moving it; a first page too short to
 *  scroll keeps loading until it fills the view or the conversation begins. A thread pages the same way. */
function loadAhead(C = MAIN) {
  const v = C.view;
  if (C.rendered !== v || v === "home" || CH.isChats(v)) return;
  if (C.follow.fromTop() > Math.max(600, C.scroller.clientHeight)) return;
  const t = convThread(v);
  if (t) { if (world.act.loadOlderThread && canPageOlder(world.state.threadHist?.[t.id])) world.act.loadOlderThread(t.id); return; }
  const c = chatOf(v); const h = c && world.state.hist[c];
  if (h && h.loaded && !h.all && !h.loading && !h.olderError) world.act.loadOlder(c);
}
/** "Earlier messages" (or "Try again"), pressed: the conversation's next older page. */
/**
 * Earlier messages, or Try again after a failed read. The button gives way to the shapes of the messages it reads,
 * so focus, if it was on it, waits on the conversation itself meanwhile; when the read is over it goes to the
 * button that's there again (Try again after another failure, Earlier messages when there's more), and stays on
 * the conversation at its beginning (Astra DET-3: it fell to the page).
 */
function loadOlderNow(C = MAIN) {
  const from = document.activeElement?.closest?.("[data-older]") ? C.view : null;
  if (from) C.scroller.focus({ preventScroll: true });
  let read = null;
  const t = convThread(C.view);
  if (t) { const th = world.state.threadHist?.[t.id]; if (th && th.olderError) th.olderError = null; if (world.act.loadOlderThread) read = world.act.loadOlderThread(t.id); }
  else { const c = chatOf(C.view); if (c) read = world.act.loadOlder(c); }
  if (from) Promise.resolve(read).finally(() => {
    if (C.view !== from || document.activeElement !== C.scroller) return;
    render();
    C.msgs.querySelector("[data-older]")?.focus({ preventScroll: true });
  });
}

/** One conversation's drawing: its messages (reconciled in place), pictures, the place you read held, the work's
 *  folds gliding, its thread's root found, its typing line; opening it lands at the latest. */
function drawConv(C, needs) {
  const v = C.view;
  const opening = C.rendered !== v;
  let quiet = opening;
  // the first real fill of a conversation lands quietly (no arrivals), and where you are
  const ready = liveReady(v);
  if (!opening && ready && C.filled !== v) quiet = true;
  C.filled = ready ? v : null;
  if (C.main) S.filled = C.filled;
  CHG.sync(v); // what this place changed: read on opening, and after each edit an agent finishes
  const items = msgItems(v, needs);
  // the work folds about to be redrawn, measured before anything changes (workMotion glides them)
  const folds = quiet ? null : foldsBefore(C, items);
  const place = !opening && !C.follow.isPinned() ? readingPlace(C) : null;
  reconcile(C.msgs, items, { quiet, fallback: () => (C.main ? $("#say") : C.scroller) });
  hydrateMedia(C.msgs); // new pictures load and fade in; redrawn ones keep their pixels
  if (place) { holdPlace(C, place); queueMicrotask(() => holdPlace(C, place)); } // after msgx's decoration too
  if (folds) workMotion(C, folds);
  ensureRoot(v);
  typingRender(C);
  // opening a conversation lands at the latest (the owner, 5 Nov). After that, follow.js keeps you there
  // while you are (its first real fill included); if you scrolled up while it loaded, you stay where you
  // went (QA R2: the fill used to count as opening it again and threw you back to the latest)
  if (opening) { C.rendered = v; if (v === "chats") C.follow.toTop(); else C.follow.toLatest(false); }
}

// ── what you're reading stays put; the agent's work moves, never jumps ─────────────────────────────
/** While you read: the first message in view and where it stands, before a redraw, so it can be put back in
 *  the same frame if the browser didn't keep it (found again by its key, so a redrawn row counts). Only a
 *  message: never the line where older pages land (its skeleton is replaced as they land), a note, or a day's
 *  line (it moves above older messages of its day). Held on that line, the place stayed at the top while a
 *  landing page pushed what you read 5,000-8,000 px down, and the hold undid the browser's own correction. */
const isMessageRow = (k) => k !== "hist" && k !== "note" && k !== "empty" && !k.startsWith("day|");
function readingPlace(C = MAIN) {
  const top = C.scroller.getBoundingClientRect().top;
  for (const el of C.msgs.children) {
    const k = el.dataset.k;
    if (!k || !isMessageRow(k)) continue;
    const r = el.getBoundingClientRect();
    if (r.height && r.bottom > top + 1) return { k, top: r.top };
  }
  return null;
}
const childOf = (C, k) => { for (const el of C.msgs.children) if (el.dataset.k === k) return el; return null; };
function holdPlace(C, a) {
  const el = childOf(C, a.k);
  if (!el) return;
  const d = el.getBoundingClientRect().top - a.top;
  if (Math.abs(d) >= 1) { C.scroller.scrollTop += d; }
}
/** Something here already moves to its own CSS animation (another layer's): motion is never stacked on it. */
function stirred(el, root) {
  for (let x = el; x && x !== root.parentElement; x = x.parentElement) if (getComputedStyle(x).animationName !== "none") return true;
  return false;
}
/**
 * Before a redraw: for each turn (or folding line) about to be redrawn, the height of each of its blocks
 * and rows ([data-b], [data-r]) and which of them it has, so workMotion can glide what changed height and
 * bring in what's new. Only the items whose markup changes are measured.
 */
function foldsBefore(C, items) {
  const out = [];
  const now = new Map();
  for (const el of C.msgs.children) if (el.dataset.k) now.set(el.dataset.k, el);
  for (const it of items) {
    const el = now.get(it.key);
    if (!el || el._h === it.html || !el.querySelector("[data-tb]")) continue;
    const parts = new Map();
    if (el.classList.contains("m-turn")) for (const x of el.querySelectorAll("[data-b],[data-r]")) parts.set(x.dataset.b ? `b:${x.dataset.b}` : `r:${x.dataset.r}`, x.offsetHeight);
    else parts.set("self", el.offsetHeight);
    out.push({ k: it.key, parts });
  }
  return out;
}
/**
 * After a redraw: a fold that opened or closed, a line that grew or shrank (a running turn's latest step,
 * the work collapsing into "Worked 3m · 27 steps" when it ends) glides to its new height; a step or a block
 * that's new arrives (motion.js). Only on screen: above what you're reading, it lands still (holdAnchor
 * kept your place). What you just opened isn't "new": its fold's glide shows it. Reduced motion: none.
 */
function workMotion(C, folds) {
  // the fold you toggled is the one in this conversation (a click remembers where it was, S.tbToggled.in)
  const toggled = S.tbToggled && (!S.tbToggled.in || S.tbToggled.in === C.msgs) ? S.tbToggled : null;
  if (toggled) S.tbToggled = null;
  if (toggled && toggled.focus) C.msgs.querySelector(`[data-tb="${CSS.escape(toggled.k)}"]`)?.focus({ preventScroll: true });
  if (still() || !folds.length) return;
  const top = C.scroller.getBoundingClientRect().top, bottom = top + C.scroller.clientHeight;
  const seen = (r) => r.bottom > top && r.top < bottom;
  for (const f of folds) {
    const el = childOf(C, f.k);
    if (!el || !seen(el.getBoundingClientRect())) continue;
    const opened = toggled ? el.querySelector(`[data-tb="${CSS.escape(toggled.k)}"]`)?.closest("[data-b],[data-r]") : null;
    const glide = (x, h0) => {
      const h1 = x.offsetHeight;
      if (!h0 || !h1 || Math.abs(h1 - h0) < 1 || x.getBoundingClientRect().top < top || stirred(x, el)) return;
      x.animate([{ height: `${h0}px`, overflow: "hidden" }, { height: `${h1}px`, overflow: "hidden" }], { duration: MOVE, easing: EASE });
    };
    if (f.parts.has("self")) { glide(el, f.parts.get("self")); continue; }
    for (const x of el.querySelectorAll("[data-b],[data-r]")) {
      const id = x.dataset.b ? `b:${x.dataset.b}` : `r:${x.dataset.r}`;
      if (f.parts.has(id)) { glide(x, f.parts.get(id)); continue; }
      // new: a step, a block of its work (not its answer: words are the message layer's to bring in)
      if ((opened && opened.contains(x)) || x.matches(".tb-answer, .tb-text, .tb-files") || !seen(x.getBoundingClientRect()) || stirred(x, el)) continue;
      if (x.parentElement.closest("[data-r]") || (x.parentElement.closest("[data-b]") && !f.parts.has(`b:${x.parentElement.closest("[data-b]").dataset.b}`))) continue; // its parent arrives with it
      arrive(x);
    }
    // the chevron of what you opened turns, as it would had it not been redrawn
    const chev = opened && opened.querySelector(`[data-tb="${CSS.escape(toggled.k)}"] .tb-chev`);
    if (chev) chev.animate([{ transform: toggled.open ? "none" : "rotate(180deg)" }, { transform: toggled.open ? "rotate(180deg)" : "none" }], { duration: MOVE, easing: EASE });
  }
}
// what scrolling asks of the page (an older page near the top, the header's edge): once a frame, not once an event
let scrollRaf = 0;
scroller.addEventListener("scroll", () => {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; loadAhead(); $("#top").classList.toggle("is-scrolled", fromTop() > 120); });
}, { passive: true });
// the dock's height, for the space under the conversation (pinned at the latest, follow.js keeps you there).
// What's docked over the composer is one stack (index.html #dock), and the notices' line sits on its top: whether
// anything is docked there is measured, not inferred from what's in the dock (the bar's top below the dock's top: a
// chip shown only on a phone, a decision hidden while a panel covers it, one gliding in or out), in the observer's
// step, before the frame is painted, so the line never lies on a docked control for a frame (css/app.css .herald)
function watchDock(dock, host) {
  const bar = dock.querySelector(".cbar");
  const ro = new ResizeObserver(() => {
    host.style.setProperty("--dock-h", `${dock.offsetHeight}px`);
    const on = bar.getBoundingClientRect().top - dock.getBoundingClientRect().top > 0.5;
    if (dock.classList.contains("is-stacked") !== on) dock.classList.toggle("is-stacked", on);
    heraldRoom(); // the line stands higher over what's docked (is-stacked)
  });
  ro.observe(dock);
  return ro;
}
watchDock($("#dock"), $("#app"));
/** Chats starts with its composer: the dock leads its scroller there, under the greeting, and sits at the foot elsewhere. */
function dockAtTop(top) {
  const dock = $("#dock"), sc = $("#scroller");
  if (top === (dock.parentElement === sc)) return;
  const had = dock.contains(document.activeElement) ? document.activeElement : null;
  if (top) $("#cs-sub").after(dock); else $("#drop-veil").after(dock);
  $("#cs-hi").hidden = $("#cs-sub").hidden = !top;
  if (!top) sc.style.removeProperty("--cs-lead");
  dock.classList.toggle("is-top", top);
  had?.focus({ preventScroll: true });
}
initFollow();

// ── navigation: back always returns exactly where you were ─────────────────
function saveScroll() {
  if (pageEl(S.view)) S.scroll[S.view] = pageEl(S.view).scrollTop;
  // a conversation always opens at the latest (the owner, 5 Nov), so its place isn't kept
}
function go(v, { from, row = null, focus = false, carry = false, panel = false, still = false } = {}) {
  if (!v) return;
  // a file with unsaved edits asks first (Files › Edit, its head): Discard, then on
  if (v !== S.view && VW.editing) { VW.leave(() => go(v, { from, row, focus, carry, panel, still })); return; }
  // an edit or menu in a thread's header belongs to that visit
  S.tEdit = null; S.tMenu = null;
  // the file viewer belongs to the conversation it was opened from
  // a page in the panel belongs to its place
  if (v !== S.view) STAGE.leave();
  closeSettings({ restore: false });
  setDrawer(false);
  IQ.close({ restore: false });
  // on a phone the panel covers the page: a place opened from it (panel: Launchpad's asked thread, a thread on the Map,
  // the panel's own links) is shown, so the panel goes, and before focus is placed below: while it covered the page,
  // the page was inert, the focus put there didn't take, and the control pressed went with the panel (grader B on
  // 5f52deb and 7137115, S193: BODY once the thread showed, at 390 only). It steps aside: open again, it's as it was.
  // A place changed from elsewhere leaves it covering (lpshell LP21: the panel's Close keeps focus)
  if (panel && v !== S.view && PHONE.matches && STAGE.isOpen) STAGE.close({ restore: false, quiet: true });
  if (v === S.view) { if (focus) say.focus(); return; }
  saveScroll(); saveDraft();
  // the phone's Back retraces the places you went; a thread's parent already knows its own way back
  if (!S.retrace && !v.startsWith("t:") && !v.startsWith("c:")) { S.trail = S.trail.filter((x) => x !== v); S.trail.push(S.view); if (S.trail.length > 30) S.trail.shift(); }
  const deeper = v.startsWith("t:") && !S.view.startsWith("t:");
  if (v.startsWith("t:")) S.parent[v] = from || (S.view.startsWith("t:") ? S.parent[S.view] : S.view);
  // each visit to a thread keeps the message it was opened from, and only that visit's Back reads it
  if (v.startsWith("t:")) S.backTo[v] = row ? { view: S.view, k: row } : null;
  const back = from && from.startsWith("t:");
  REC.leave(S.view, v);
  S.view = v;
  follow();
  TD.key = null; tdock.innerHTML = ""; tdock._ch = "";
  const el = pageEl(v) || $("#column");
  el.classList.remove("enter-r", "enter-l", "enter", "enter-up");
  void el.offsetWidth;
  if (!still) el.classList.add(carry ? "enter-up" : deeper ? "enter-r" : back ? "enter-l" : "enter");
  loadDraft();
  render();
  if (pageEl(v)) pageEl(v).scrollTop = S.scroll[v] || 0;
  const was = back ? S.backTo[from] : null;
  if (back) delete S.backTo[from];
  const left = was && was.view === v ? $("#msgs").querySelector(`:scope > [data-k="${CSS.escape(was.k)}"]`) : null;
  const target = left ? left.querySelector(`[data-go="${CSS.escape(from)}"]`) || left.querySelector("[data-go]") : null;
  if (focus) say.focus({ preventScroll: true });
  else if (back && target) target.focus({ preventScroll: true });
  // the place's own reading region: a page's own section (the conversation's scroller is hidden there), else the
  // conversation; never a hidden one (Astra H8: Jump → Artifacts landed on the page)
  else if (!$("#panel").contains(document.activeElement)) (pageEl(v) || scroller).focus({ preventScroll: true });
  returnPill(back && target && !focus ? target : null);
}
/** Return to where you were (Astra's I1): coming back to a conversation still lands at its latest (the owner's
    rule), and when the message you left from is above, a quiet pill offers the way back to it, deliberately. */
function returnPill(target) {
  let pill = $("#mx-return");
  // the message is held by its key, never its node: a redraw replaces nodes, and the key finds the one now drawn
  const row = target && target.closest ? target.closest("#msgs > [data-k]") : null;
  const key = row ? row.dataset.k : null;
  if (!key) { if (pill) pill.hidden = true; return; }
  const find = () => msgsEl.querySelector(`:scope > [data-k="${CSS.escape(key)}"]`);
  const inSight = (el) => { const a = el.getBoundingClientRect(), b = scroller.getBoundingClientRect(); return a.bottom > b.top + 40 && a.top < b.bottom - 120; };
  requestAnimationFrame(() => {
    const el = find();
    if (!el || inSight(el)) { if (pill) pill.hidden = true; return; }
    if (!pill) {
      pill = document.createElement("button");
      pill.type = "button"; pill.id = "mx-return"; pill.className = "mx-return";
      $("#conv").append(pill);
      pill.addEventListener("click", () => {
        pill.hidden = true;
        const el = pill._find && pill._find();
        if (!el) return; // it isn't drawn any more: nothing to go back to
        toRow(el, true);
        // the control you left from (the card or link that opened the thread), else the first one in the message
        const back = el.querySelector("[data-go]") || [...el.querySelectorAll("button, a[href]")].find((b) => b.offsetParent);
        back?.focus({ preventScroll: true });
        el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash"); setTimeout(() => el.classList.remove("is-flash"), 1800);
      });
      scroller.addEventListener("scroll", () => {
        if (pill.hidden || !pill._find) return;
        const el = pill._find();
        if (!el || pill._seen(el)) pill.hidden = true; // gone, or you've reached it
      }, { passive: true });
    }
    pill._find = find; pill._seen = inSight;
    pill.style.top = `${scroller.offsetTop + space("--s-3")}px`; // --s-3 under the header, whatever its height
    pill.innerHTML = `${ICON.arrow}<span>Back to where you were</span>`;
    pill.hidden = false;
  });
}
/** Has this conversation's real content arrived (timeline or thread detail)? */
function liveReady(v) {
  const t = convThread(v);
  if (t) return t.loaded;
  const h = world.state.hist[chatOf(v)];
  return !!h && !(h.loading && !(world.state.timeline[chatOf(v)] || []).length);
}
/** Stream the open conversation (the Workspace on Home); poll an open thread's detail. */
function follow() {
  const v = S.view, t = convThread(v);
  if (CH.isChats(v)) { world.act.watch([]); world.act.watchThread(null); world.act.watchSession?.(v.startsWith("c:") ? v.slice(2) : null); CH.open(v); return; }
  world.act.watchSession?.(null);
  // a thread's hops are always read: a message relayed into it shows in place (if1 #7); their lines stay by choice
  if (t && world.act.loadHops) world.act.loadHops(t.id);
  // a chat's hops are read on opening it too: the coordinator's "Waiting for … to reply" needs its open asks
  // (the hop lines themselves still show only by choice)
  if (!t) loadChatHops(v);
  world.act.watch(v === "home" || v === "ws" ? ["workspace"] : v.startsWith("p:") ? [v.slice(2)] : t ? [t.project] : []);
  world.act.watchThread(t ? t.id : null);
}
/** "Show hops" on the Workspace or a project: read that chat's own hops once. */
function loadChatHops(v) {
  const chat = v === "ws" || v === "home" ? "workspace" : v.startsWith("p:") ? v.slice(2) : null;
  if (chat && world.act.loadChatHops) world.act.loadChatHops(chat);
}
/** An open thread's root request lives on the project timeline; page back until it's there. */
/** An open thread's root request (on the project's timeline): looked up by id once the thread has been read
 *  back to its beginning, just below its first message. It used to page the project's own conversation back
 *  (up to 6 pages), which grew that conversation for nothing. */
function ensureRoot(view = S.view) {
  const t = convThread(view);
  if (!t || !world.act.findRows) return;
  const th = world.state.threadHist?.[t.id];
  if (!th || !th.loaded || !th.all) return;
  if ((world.state.timeline[t.project] || []).some((r) => r.id === t.id) || world.state.found?.[t.project]?.has(t.id)) return;
  const first = t.messages.find((m) => m.seq != null);
  world.act.findRows(t.project, [t.id], first ? first.seq : null);
}
function back() {
  const v = S.view;
  S.retrace = true;
  if (v.startsWith("c:")) go("chats", { from: "t:" });
  else if (v.startsWith("t:")) go(S.parent[v] || "p:" + convThread(v)?.project, { from: v });
  S.retrace = false;
}
$("#top-back").addEventListener("click", back);

/** Open a decision: in a thread, its own card; elsewhere the panel. */
function decideKey(key, opts) {
  const t = convThread(S.view);
  const n = D.needItems().find((x) => x.key === key);
  if (t && n && n.t.id === t.id && !D.isOpen() && !opts) {
    // asked to open this thread's own decision: it opens, folded or not (Astra S150: its notice left it folded)
    delete S.dockFold[key];
    if (n.later) S.later.delete(key);
    if (n.held) D.bringIn(key);
    schedule();
    requestAnimationFrame(() => requestAnimationFrame(() => tdock.querySelector(".card")?.focus({ preventScroll: true })));
    return;
  }
  D.open(key, opts);
}

/** After going to a conversation, bring one message into view and mark it for a moment (if it's loaded). */
function showMsg(id, C = MAIN) {
  let tries = 0;
  const look = () => {
    const el = C.msgs.querySelector(`[data-k="${CSS.escape(S.alias.get(id) || id)}"]`);
    if (!el) { if (++tries < 20) setTimeout(look, 100); return; }
    C.follow.toRow(el, true); // through follow.js: following stops, then the row is centred (never scrollIntoView)
    el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1800);
  };
  setTimeout(look, 120); // after the conversation has drawn and restored its scroll
}

// ── files on messages (hub #30): the shared-file card, opening in the same viewer ──
/** The project a forwarded copy came from, when it wasn't the Workspace's own message (else null). */
function fwdSource(fwd) {
  const p = fwd.chatId && world.act.projectOf ? world.act.projectOf(fwd.chatId) : null;
  if (p) return p === "workspace" ? null : p;
  const v = fwd.via || [];
  return v.length > 1 && v[0] !== "workspace" && v[0] !== "project" && world.project(v[0]) ? v[0] : null;
}
/** The emoji agents put on a message, one chip per emoji with its count; hover names who. */
function reactionsHtml(reactions) {
  const groups = reactionGroups(reactions);
  if (!groups.length) return "";
  return `<div class="m-reacts" aria-label="Reactions">${groups.map((g) => {
    const who = g.by.map(reactorName).join(", ") || "An agent";
    return `<span class="m-react" title="${esc(`${who} reacted ${g.emoji}`)}">${esc(g.emoji)}${g.count > 1 ? `<span class="m-react-n">${g.count}</span>` : ""}</span>`;
  }).join("")}</div>`;
}
function reactorName(sessionId) {
  const s = (world.state.sessions || {})[sessionId];
  if (!s) return "An agent";
  if (s.role === "workspace-coordinator") return "The Workspace coordinator";
  const p = s.chat_id && world.act.projectOf ? world.act.projectOf(s.chat_id) : null;
  if (s.role === "project-coordinator") return p && p !== "workspace" ? `The ${PROJ(p)} coordinator` : "The coordinator";
  return p && p !== "workspace" ? `A ${PROJ(p)} agent` : "An agent";
}
/**
 * A picture or a file in the conversation (js/media.js): a picture opens in the lightbox over it, walking
 * every picture here (⇧ opens it beside, in the viewer); a file opens in the viewer. One that couldn't
 * load tries again instead.
 */
function openMedia(el, e) {
  if (retryMedia(el)) return;
  const it = mediaItemOf(el.dataset.mx);
  if (!it) return;
  // ← → walk the conversation's pictures; a picture elsewhere (an ask's words, a document) walks its own set
  const root = msgsEl.contains(el) ? msgsEl : el.closest(".mx-stack")?.parentElement || msgsEl;
  // ⇧ opens a file in the viewer; a web picture has no file here, so it's the lightbox either way
  if (it.kind === "image" && (!e.shiftKey || it.web)) LB.open(it.key, el, root);
  else VW.open(viewerFile(it), el);
}

// ── shared files: open in the viewer beside the conversation (if1 #2) ──
/**
 * Where an agent's path is served from: a thread's file is in its own folder; in a project's conversation
 * (its coordinator's words) a relative path is the project folder's; a plain chat's files have no route yet.
 */
// the conversation a file belongs to: the one being drawn (a thread page draws its own), else the main chat's
let drawing = null;
function fileRoute(path, conv = drawing || S.view) {
  const t = convThread(conv);
  const pid = !t && conv.startsWith("p:") ? conv.slice(2) : null;
  const rel = String(path || "").replace(/^\.\//, "");
  return pid && rel && !rel.startsWith("/") && !rel.split("/").some((x) => x === ".." || x === "") ? { project: pid, rel } : sharedFileRoute(t, path);
}
function openSharedFile(btn) {
  // a size only when the entry says one: an entry without data-file-bytes has none (Astra S224: "NaN MB")
  const raw = btn.dataset.fileBytes, n = raw == null || raw === "" ? NaN : Number(raw);
  const f = { path: btn.dataset.file, name: btn.dataset.fileName, type: btn.dataset.fileType, bytes: Number.isFinite(n) ? n : null };
  // the chip's own conversation decides where its file is (a thread page's chip: that thread's worktree), not the
  // main chat's view: at a click nothing is being drawn, so fileRoute would fall back to S.view
  VW.open({ ...f, ...fileRoute(f.path, convAt(btn).view) }, btn);
}

// ── "Ask about these lines" (Files, js/viewer.js): to the file's own thread, else its project's coordinator ──
/** Your words; a question about lines leads with them as an in-app capsule that opens Files there. */
function youText(text) {
  const r = lineRef(text);
  if (!r) {
    // a question about a whole file: its capsule, then your words
    const f = fileRef(text);
    if (!f) return esc(text);
    return `<a href="#${esc(f.path)}" class="lk lk-in lk-file" data-ref="${esc(f.path)}" title="${esc(f.path)}"><span class="lk-ic">${fileIcon(f.path.split("/").pop())}</span><span class="lk-t">${esc(f.path.split("/").pop())}</span></a>\n${esc(f.rest)}`;
  }
  const name = r.path.split("/").pop(), lines = r.a === r.b ? `${r.a}` : `${r.a}–${r.b}`;
  return `<a href="#${esc(r.path)}" class="lk lk-in lk-file" data-ref="${esc(r.path)}" data-ref-a="${r.a}" data-ref-b="${r.b}" title="${esc(`${r.path}, ${r.a === r.b ? "line" : "lines"} ${lines}`)}"><span class="lk-ic">${fileIcon(name)}</span><span class="lk-t">${esc(name)} · ${lines}</span></a>\n${esc(r.rest)}`;
}
/** A question's capsule: Files, at those lines of the file in this conversation's place, selected. */
function openLineRef(a) {
  const s = CHG.scope(convAt(a).view), path = a.dataset.ref;
  if (!s) return;
  const lines = a.dataset.refA ? [+a.dataset.refA, +a.dataset.refB] : null;
  VW.open({ path, name: path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${path}` : path, ...(lines ? { lines } : {}) }, a);
}
/** Where a question about a project file goes: {conv, thread, chat, name, path (in its place)}, or null. */
function askPlace(f) {
  if (!f || !f.project || !f.rel) return null;
  const fs = fileScope(f, { threads: world.state.threads, project: PROJ });
  const path = fs && localIn(fs, f);
  if (path == null) return null;
  const thread = fs.tid ? world.thread(fs.tid) : null;
  return thread ? { conv: `t:${thread.id}`, thread, chat: thread.project, name: thread.title || "this thread", path } : { conv: convOfChat(f.project), thread: null, chat: f.project, name: PROJ(f.project), path };
}
/**
 * Send "path:a-b" and the question, as your message there. The agent reads the path and lines first;
 * your bubble shows them as a capsule that opens Files at those lines (timeline.js lineRef).
 */
function askAboutLines(f, a, b, text) {
  const at = askPlace(f);
  return !!at && sendAbout(f, `${at.path}:${a}${b > a ? `-${b}` : ""}\n\n${text}`);
}
/** Beside the chat (Layout A, the owner's D4): asking about lines puts them in this conversation's own composer
 *  as a capsule, and the composer has focus. The file's place must be this conversation; else false (the
 *  file's own composer asks, as before). */
function composeAbout(f, a, b) {
  // the chat is always beside the panel's file now: the lines go into its composer
  const at = askPlace(f);
  if (!at || at.conv !== S.view || CH.isChats(S.view)) return false;
  S.lref[S.view] = { path: at.path, a, b, name: f.name || at.path.split("/").pop() };
  lrefRender();
  say.focus({ preventScroll: true });
  announce(`Lines ${a}${b > a ? ` to ${b}` : ""} of ${S.lref[S.view].name} are in your message. Write your question.`);
  return true;
}
/** Ask about this (Astra's I7): the whole file, as a capsule in the composer of the conversation it belongs to (that
    conversation opens if it isn't this one); the line above the field already names who receives it. Nothing is
    sent until you write and send; × takes it out. */
function askAboutFile(f) {
  const at = askPlace(f);
  if (!at) { announce("This file isn't in a project XO can ask about."); return false; }
  const ref = { path: at.path, a: null, b: null, name: f.name || at.path.split("/").pop() };
  if (at.conv !== S.view) { VW.close({ restore: false }); go(at.conv); }
  S.lref[at.conv] = ref;
  lrefRender();
  say.focus({ preventScroll: true });
  announce(`${ref.name} is in your message to ${at.name}. Write your question.`);
  return true;
}
/** The capsule above the composer's field: the file and its lines (opens them), and × to take it out. */
function lrefRender() {
  const r = S.lref[S.view], el = $("#cref");
  const lines = r && r.a ? ` · ${r.a}${r.b > r.a ? `–${r.b}` : ""}` : "";
  const html = r ? `<a href="#${esc(r.path)}" class="lk lk-in lk-file" data-ref="${esc(r.path)}"${r.a ? ` data-ref-a="${r.a}" data-ref-b="${r.b}"` : ""} title="${esc(r.a ? `${r.path}, ${r.a === r.b ? "line" : "lines"} ${r.a}${r.b > r.a ? `–${r.b}` : ""}` : r.path)}"><span class="lk-ic">${fileIcon(r.name)}</span><span class="lk-t">${esc(r.name)}${lines}</span></a>` +
    `<button type="button" class="cref-x" data-lref-x aria-label="${r.a ? `Take ${r.a === r.b ? "the line" : "the lines"} out of this message` : `Take ${esc(r.name || r.path.split("/").pop())} out of this message`}" title="${r.a ? (r.a === r.b ? "Take it out" : "Take them out") : "Take the file out"}">${ICON.close}</button>` : "";
  el.hidden = !r;
  if (el._h !== html) { redraw(el, html); el._h = html; }
}
/** A message about a project file, as yours, in its thread (or its project's chat). True when it went. */
function sendAbout(f, text) {
  const at = askPlace(f);
  if (!at) return false;
  // the file's own place decides (its thread, or its project's chat), never the chat or draft on screen
  const block = blockFor(at.thread ? { thread: true } : { pid: at.chat });
  if (block) { refuse(block); return false; }
  const m = { id: `l${++S.n}_${Date.now().toString(36)}`, conv: at.conv, at: Date.now(), who: "you", text, status: "sending", target: at.thread ? null : at.chat, to: at.name, cid: `ui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
  (S.local[at.conv] = S.local[at.conv] || []).push(m);
  sound.play("send");
  heraldShow(noticeFor(m, "out"), 9000);
  if (at.thread) STAGE.resumeFollow(at.conv);
  deliverLive(m, at.thread);
  schedule();
  return true;
}

// ── a thread's own header: resolve and reopen with Undo (R1), rename, label ──
/**
 * Resolve or reopen. One request at a time per thread (js/pending.js): a second press, a held Enter, or the
 * All row's swipe while the header's is out, joins the first, and the button says it's waiting. "Resolved" is
 * said only once Space has. A refusal says so with Retry; sayFail: false leaves that to the caller (the All
 * row, whose herald sits behind the sheet). Resolves to {ok} and, refused, {why}.
 */
function resolveThread(tid, resolved, { undo = true, sayFail = true } = {}) {
  const p = once(`resolve:${tid}`, async () => {
    const t = world.thread(tid);
    if (!t) return { ok: false, why: "That thread isn't loaded." };
    const name = t.title;
    schedule(); // the button, drawn as waiting
    // This thread's resolve and reopen have one notice between them (mid): the newer word replaces the older, on
    // screen or waiting, and an outcome with nothing to say takes the older away. A refusal's "Couldn't resolve it ·
    // Retry" never outlives a later resolve that worked (the controls grader on 1ef7056, C041: it stayed, and its
    // Retry sent a third PATCH to a resolved thread).
    const about = `resolve:${tid}`;
    const say = (h, ms) => { if (!heraldFor(about, () => h, ms)) heraldShow(h, ms); };
    try {
      await world.act.resolve(tid, resolved);
    } catch (err) {
      announce(`${resolved ? "Couldn't resolve" : "Couldn't reopen"} ${name}. ${err.message}`);
      if (sayFail) say({ kind: "stopped", text: resolved ? "Couldn't resolve it" : "Couldn't reopen it", sub: err.message, mid: about, back: [`[data-resolve="${CSS.escape(tid)}"]`], undo: () => resolveThread(tid, resolved, { undo }), undoLabel: "Retry" }, 8000);
      else heraldDrop(about);
      return { ok: false, why: err.message };
    }
    announce(resolved ? `Resolved ${name}.` : `Reopened ${name}.`);
    // Undo is the same call the other way (the route is idempotent); it never starts or stops a turn
    if (undo) say({ kind: "done", text: resolved ? "Resolved" : "Reopened", sub: name, mid: about, back: [`[data-resolve="${CSS.escape(tid)}"]`], undo: () => resolveThread(tid, !resolved, { undo: false }) }, 6000);
    else heraldDrop(about);
    return { ok: true };
  });
  p.finally(schedule); // drawn again once the request is no longer out
  return p;
}
/** The header's ⋯ menu closed: Escape, Tab, a choice made, a click elsewhere. Focus goes back to ⋯ when it was
 *  in the menu (Tab then goes on from ⋯). */
function closeThreadMenu({ focus = true } = {}) {
  if (!S.tMenu) return;
  const back = focus && !!document.activeElement?.closest?.(".tw-menu");
  const opener = S.tMenuIn === "page" ? "#tpacts [data-tmenu]" : "#top-who [data-tmenu]";
  S.tMenu = null; S.tMenuIn = null; $("#top-who")._h = null; if ($("#tphead")) $("#tphead")._h = "";
  if (!back) { schedule(); return; }
  render();
  $(opener)?.focus({ preventScroll: true });
}
menuKeys($("#top"), { close: () => closeThreadMenu() });
function startThreadEdit(tid, field) {
  const t = world.thread(tid);
  if (!t) return;
  S.tEdit = { tid, field, value: field === "title" ? t.title : t.label || "" };
  $("#top-who")._h = null;
  render();
  const inp = $("#tw-edit");
  if (inp) { inp.focus(); inp.select(); }
}
/** The field closes (saved, unchanged, or Escape): the header shows the name again and, if focus was in the
 *  field, it goes to ⋯, where the rename came from. Only the edit that is still open closes. */
function endThreadEdit(edit) {
  if (S.tEdit !== edit) return;
  const had = document.activeElement?.id === "tw-edit";
  S.tEdit = null; $("#top-who")._h = null; render();
  if (had) $("[data-tmenu]")?.focus({ preventScroll: true });
}
/**
 * Save the header field being edited. While it saves, the field stays as typed, says it's waiting (aria-busy,
 * read-only) and keeps focus; a second Enter joins the first. Saved, it closes (endThreadEdit). Refused, it stays
 * open with what was typed and its focus, and says why, so the retry is one Enter away.
 */
function saveThreadField(tid, field, value) {
  const edit = S.tEdit && S.tEdit.tid === tid && S.tEdit.field === field ? S.tEdit : null;
  const t = world.thread(tid);
  if (!t) { if (edit) endThreadEdit(edit); return Promise.resolve(); }
  const v = String(value || "").trim();
  if ((field === "title" && (!v || v === t.title)) || (field === "label" && v === (t.label || ""))) { if (edit) endThreadEdit(edit); return Promise.resolve(); }
  return once(`thread-edit:${tid}:${field}`, async () => {
    if (edit) { edit.value = value; edit.busy = true; }
    const inp = edit && $("#tw-edit");
    if (inp) { inp.readOnly = true; inp.setAttribute("aria-busy", "true"); }
    try {
      await world.act.editThread(tid, field === "title" ? { title: v.slice(0, 120) } : { label: v ? v.slice(0, 32) : null });
    } catch (err) {
      if (edit) { edit.busy = false; edit.failed = value; }
      if (inp && inp.isConnected) { inp.readOnly = false; inp.removeAttribute("aria-busy"); }
      announce(`${field === "title" ? "Couldn't rename it" : "Couldn't change the label"}. ${err.message} What you typed is kept.`);
      heraldShow({ kind: "stopped", text: field === "title" ? "Couldn't rename it" : "Couldn't change the label", sub: err.message }, 6000);
      return;
    }
    announce(field === "title" ? `Renamed to ${v}.` : v ? `Labelled ${v}.` : "Label removed.");
    if (edit) endThreadEdit(edit);
  });
}
// "Coordinator needs you" in a chat's header: the card above the composer, unfolded and in focus
$("#top").addEventListener("click", (e) => {
  const b = e.target.closest("[data-dock-open]");
  if (!b) return;
  delete S.dockFold[b.dataset.dockOpen];
  dockRender(D.needItems());
  requestAnimationFrame(() => tdock.querySelector(".card")?.focus({ preventScroll: true }));
});
$("#top").addEventListener("keydown", (e) => {
  const inp = e.target.closest?.("[data-tedit]");
  if (inp) {
    // an IME composing owns Enter and Escape (they commit or cancel its words): not the rename's, nor the page's
    if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; }
    if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (S.tEdit) saveThreadField(S.tEdit.tid, inp.dataset.tedit, inp.value); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (S.tEdit && !S.tEdit.busy) endThreadEdit(S.tEdit); }
    return;
  }
  // the menu's own keys (↓ ↑ Home End, Escape, Tab) are menuKeys'; this is Escape with focus on ⋯ itself
  if (e.key === "Escape" && S.tMenu) { e.preventDefault(); e.stopPropagation(); closeThreadMenu(); }
});
$("#msgs").addEventListener("input", (e) => { if (e.target.matches?.("[data-chl-q]")) CH.search(e.target.value); });
$("#msgs").addEventListener("click", (e) => {
  const b = e.target.closest?.("[data-chl-all]");
  if (!b) return;
  const all = b.dataset.chlAll === "1";
  // the greeting keeps its place: the list grows under it instead of the page recentring
  const sc = $("#scroller");
  if (all) sc.style.setProperty("--cs-lead", getComputedStyle($("#cs-hi")).marginTop); else sc.style.removeProperty("--cs-lead");
  CH.showAll(all);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const top = $("#msgs .chl-top");
    if (!top) return;
    (all && !matchMedia("(max-width: 760px)").matches ? top.querySelector("[data-chl-q]") : top.querySelector("[data-chl-all]"))?.focus({ preventScroll: true });
  }));
});
$("#top").addEventListener("input", (e) => { if (e.target.closest?.("[data-tedit]") && S.tEdit) S.tEdit.value = e.target.value; });
// leaving the field saves it, unless it's what was just refused (Enter retries that; leaving keeps it, as typed)
$("#top").addEventListener("focusout", (e) => {
  const inp = e.target.closest?.("[data-tedit]");
  if (inp && S.tEdit) setTimeout(() => { const ed = S.tEdit; if (ed && !ed.busy && inp.isConnected && document.activeElement !== inp && inp.value !== ed.failed) saveThreadField(ed.tid, inp.dataset.tedit, inp.value); }, 0);
});

// ── clicks ──────────────────────────────────────────────────────────────────
/** The conversation a control is in (P1 step 8): the panel's thread page, else the main chat. */
const convAt = (el) => (TP.box && el && TP.box.contains(el) ? TP.C : MAIN);
const composerAt = (el) => (TP.box && el && TP.box.contains(el) ? TP.K : MK);
/** The conversation in use: the panel's thread page while focus is in it or it covers the chat, else the main chat. */
function composerNow() {
  if (!TP.K || STAGE.pageShown?.name !== "thread") return MK;
  if (document.body.classList.contains("stage-full") || PHONE.matches) return TP.K;
  const a = document.activeElement;
  // focus dropped with the control it was on (a pressed Interrupt redrawn away): the one you were in
  if (!a || a === document.body) return S.kNow || MK;
  return TP.box.contains(a) ? TP.K : MK;
}
const composers = () => (TP.K ? [MK, TP.K] : [MK]);
// the notices' line follows you between the chat and the panel's thread page
document.addEventListener("focusin", () => { const K = composerNow(); if (K !== S.kNow) { S.kNow = K; schedule(); } });
const rowIn = (el) => el.closest("#msgs > [data-k]")?.dataset.k || null;
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("#iq-pop")) return;
  const g = t.closest("[data-go]");
  // (the panel's own links are the panel's: it opens a thread as its page beside a chat, else goes as the panel)
  if (g && !t.closest("#all") && !t.closest("#stage")) { e.preventDefault(); go(g.dataset.go, { row: rowIn(g) }); if (g.dataset.goMsg) showMsg(g.dataset.goMsg); return; }
  const tl = t.closest("a[data-thread]");
  if (tl) { e.preventDefault(); if (world.thread(tl.dataset.thread)) { if (t.closest("#stage")) openFromPanel("t:" + tl.dataset.thread, e); else go("t:" + tl.dataset.thread, { row: rowIn(tl) }); } else heraldShow({ kind: "calm", text: "That thread isn't loaded", sub: "it may be in another project" }, 3200); return; }
  if (t.closest("[data-older]")) { loadOlderNow(convAt(t)); return; }
  const so = t.closest("[data-start]");
  if (so) { startDraft(+so.dataset.start); return; }
  const d = t.closest("[data-decide]");
  if (d) { decideKey(d.dataset.decide); return; }
  if (t.closest("[data-next]")) { openNext(); return; }
  if (t.closest("[data-create]")) { CREATE.open(); return; }
  if (t.closest("[data-all-threads]")) { openAll(); return; }
  const sw = t.closest("[data-switch]");
  if (sw) { if (allEl.hidden) openAll(sw); else closeAll(); return; }
  const sh = t.closest("[data-shell]");
  if (sh) { openShell(sh.dataset.shell); return; }
  if (t.closest("[data-open-all]")) { D.open(homeParts().next?.key); return; }
  if (t.closest("[data-glances]")) { D.open(null, { only: "glance" }); return; }
  const l = t.closest("[data-later]");
  // Later, Bring back, Bring in change what's next: focus goes to the next move as Home redraws (Astra S029/S035/S036)
  if (l) { S.homeFocusNext = true; D.laterNow(l.dataset.later); S.pin = null; return; }
  if (t.closest("[data-bring]")) { S.homeFocusNext = true; S.later.clear(); announce("Brought back. They're in today's list again."); schedule(); return; }
  if (t.closest("[data-handled]")) { setHandled(!S.handledOpen); return; }
  const bi = t.closest("[data-bring-in]");
  if (bi) { S.homeFocusNext = true; D.bringIn(bi.dataset.bringIn); return; }
  const ru = t.closest("[data-rec-undo]");
  if (ru) { undoRecord(ru.dataset.recUndo); return; }
  // a notice's Undo or Retry: its line goes once it's used, so focus goes first to the control it acts on (Resolve,
  // Interrupt, Stop), else the message box, and lands there again after the draw that follows, where that control
  // may be drawn anew (Astra: Undo and Retry left focus on BODY)
  if (t.closest("[data-herald-undo]")) {
    const h = S.herald, u = h?.undo;
    // a notice whose Undo names its own destination (Launchpad's) is left to it (lpshell LP21/LP36)
    if (!h?.ownFocus) { heraldBack(h)?.focus({ preventScroll: true }); const K = composerNow(); S.focusNext = [...((h && h.back) || []), () => K.say]; }
    if (typeof u === "function") { if (h.undoUntil && Date.now() > h.undoUntil) return; h.until = 0; u(); heraldNext(); } else if (u) undoRecord(u); // past its deadline an Undo undoes nothing: it does nothing
    return;
  }
  // Chats: "send now" would stop background tasks; a failed prompt
  // both leave with the question or the failed line they're on: the composer is where you are next
  const chc = t.closest("[data-chc]");
  if (chc) { const had = chc.contains(document.activeElement); CH.resolveConfirm(S.view, chc.dataset.chc); if (had) say.focus({ preventScroll: true }); return; }
  const chr = t.closest("[data-chat-retry]");
  if (chr) {
    // a Chat's Retry passes the same gate as its composer (an ended chat, XO out of reach, a limit)
    const block = liveBlock();
    if (block) { refuse(block, "the message stays, to retry"); return; }
    const had = chr.contains(document.activeElement); CH.retry(chr.dataset.chatRetry); if (had) say.focus({ preventScroll: true }); return;
  }
  const che = t.closest("[data-chat-edit]");
  if (che) { const text = CH.edit(che.dataset.chatEdit); if (text != null) putBack(text); return; }
  if (e.target.closest("[data-chat-stop]")) { stopRun(convAt(t).view); return; }
  // sub-agents: the strip under the checklist, the log, a sub-agent's row in a turn
  const rc = t.closest("[data-run-call]");
  if (rc) { const th = convThread(convAt(rc).view); const r = [...(world.state.runs?.values() || [])].find((x) => x.spawn === rc.dataset.runCall); openRuns(th, r ? r.id : null); return; }
  const ro = t.closest(".thead [data-run]");
  if (ro) { openRuns(convThread(convAt(ro).view), ro.dataset.run); return; }
  if (t.closest(".thead [data-runs]")) { openRuns(convThread(convAt(t).view)); return; }
  // storm blocks: open or fold a block or a row (thinking steps, an activity group, a command's output)
  const tb = t.closest("[data-tb]");
  if (tb) {
    const k = tb.dataset.tb; S.tbOpen[k] = !S.tbOpen[k];
    // you opened this to read it where it is: it unfolds downward and the view stays (even at the latest;
    // pressing the agent's working bubble instead goes back to following, msgx.js)
    const tc = convAt(tb);
    if (tb.closest(".msgs")) tc.follow.unpin();
    // the redraw replaces this line: its fold glides (workMotion, in the conversation it's in), and focus comes back to it
    S.tbToggled = { k, open: S.tbOpen[k], focus: tb === document.activeElement || tb.contains(document.activeElement), in: tc.msgs };
    schedule(); return;
  }
  // a thread's own header: resolve or reopen (R1), rename, label
  const rs = t.closest("[data-resolve]");
  if (rs) { resolveThread(rs.dataset.resolve, rs.dataset.to === "resolve"); return; }
  const tm = t.closest("[data-tmenu]");
  if (tm) {
    const where = tm.dataset.tmenuIn || "main", again = S.tMenu === tm.dataset.tmenu && S.tMenuIn === where;
    S.tMenu = again ? null : tm.dataset.tmenu; S.tMenuIn = again ? null : where;
    $("#top-who")._h = null; if ($("#tphead")) $("#tphead")._h = "";
    render(); // drawn now, in the click: the menu is there under the pointer at once (it was a frame or two late)
    if (S.tMenu) focusOpened(tm.parentElement.querySelector(".tw-menu"), e);
    return;
  }
  const tf = t.closest("[data-tfield]");
  // the thread's ⋯: previous / next thread, copy its branch's name
  const tg = t.closest("[data-tgo]");
  if (tg) { if (tg.getAttribute("aria-disabled") !== "true" && tg.dataset.tgo) { const page = S.tMenuIn === "page"; closeThreadMenu({ focus: false }); if (page && tg.dataset.tgo.startsWith("t:")) STAGE.show("thread", tg.dataset.tgo.slice(2), { focus: true }); else go(tg.dataset.tgo); } return; }
  const tsd = t.closest("[data-tside]");
  if (tsd) { const th = world.thread(tsd.dataset.tside); closeThreadMenu({ focus: false }); if (th) { go("p:" + th.project); STAGE.show("thread", th.id, { focus: true }); } return; }
  // from the page, what its own page's header does in place (rename, label, delete, another runtime): there, started
  const fromPage = S.tMenuIn === "page" && (t.closest("[data-tfield]:not([data-tfield=clear-label])") || t.closest("[data-tdel]") || t.closest("[data-tmove]"));
  if (fromPage) {
    const tid = S.tMenu;
    STAGE.closePage("thread"); S.tMenu = null; S.tMenuIn = null;
    go("t:" + tid); // drawn in this step: what the item leads to starts here too, never a frame later
    if (fromPage.dataset.tdel) { S.tDel = tid; $("#top-who")._h = null; render(); $("[data-tdel-no]")?.focus({ preventScroll: true }); }
    else if (fromPage.dataset.tfield) startThreadEdit(tid, fromPage.dataset.tfield);
    else { const sid = sessionOf(S.view), ch = IQ.runtimeChoice(sid), to = ch.list.find((o) => o.id !== ch.on && o.usable); if (to) IQ.open(sid, $("#iq"), { rt: to.id }); }
    return;
  }
  const tc = t.closest("[data-tcopy]");
  if (tc) { const b = tc.dataset.tcopy; closeThreadMenu(); navigator.clipboard?.writeText(b).then(() => heraldShow({ kind: "done", text: "Branch name copied", sub: b }, 2400), () => heraldShow({ kind: "stopped", text: "Couldn't copy the branch name", sub: b }, 4200)); return; }
  const td = t.closest("[data-tdel]");
  if (td) { const tid = td.dataset.tdel; S.tMenu = null; S.tDel = tid; $("#top-who")._h = null; render(); requestAnimationFrame(() => $("[data-tdel-no]")?.focus({ preventScroll: true })); return; }
  if (t.closest("[data-tdel-no]")) { const tid = S.tDel; S.tDel = null; $("#top-who")._h = null; render(); $(`[data-tmenu="${CSS.escape(tid || "")}"]`)?.focus({ preventScroll: true }); return; }
  const tdy = t.closest("[data-tdel-yes]");
  if (tdy) { deleteThread(tdy.dataset.tdelYes); return; }
  const lb = t.closest("[data-limit]");
  if (lb) { decideLimit(lb.dataset.limit, lb.dataset.limitD); return; }
  const tmv = t.closest("[data-tmove]");
  if (tmv) {
    // the thread menu's way to another runtime: the composer's picker, looking at the first one that can take it. The
    // picker opens first, in this step, and takes focus; only then does the menu go. Never a menu closed, then what it
    // opens a frame later: focus was on the page between (the create-project grader on 8aa58d3, S012). (The picker
    // closes on a pointerdown outside it, which this click has already had.)
    const sid = sessionOf(S.view), ch = IQ.runtimeChoice(sid), to = ch.list.find((o) => o.id !== ch.on && o.usable);
    if (to) IQ.open(sid, $("#iq"), { rt: to.id });
    if (to) { S.tMenu = null; $("#top-who")._h = null; schedule(); } else closeThreadMenu();
    return;
  }
  const unf = t.closest("[data-unfreeze]");
  if (unf) { unfreeze(unf.dataset.unfreeze, unf); return; }
  // Rename and the label open their field (focus goes there); Remove the label is done from ⋯ (focus back on it)
  if (tf) { const tid = S.tMenu; if (tf.dataset.tfield === "clear-label") { closeThreadMenu(); saveThreadField(tid, "label", ""); } else { S.tMenu = null; startThreadEdit(tid, tf.dataset.tfield); } return; }
  if (S.tMenu && !t.closest(".tw-menu")) closeThreadMenu({ focus: false });
  if (t.closest("[data-ck]")) { const tc = convAt(t), th = convThread(tc.view); if (th) { S.ckOpen[th.id] = !S.ckOpen[th.id]; if (tc === MAIN) checklistRender(D.needItems()); else checklistRender(D.needItems(), $("#tpthead"), tc.view, "tck-list"); } return; }
  const o = t.closest("[data-nx-opt]");
  if (o) { const n = homeParts().next; if (n) { o.classList.add("pressed"); nextDecide({ option: n.ask.options[+o.dataset.nxOpt] }); } return; }
  if (t.closest("[data-nx-allow]")) { nextDecide("allow"); return; }
  if (t.closest("[data-nx-back]")) { const card = $("#hm-next .next"); morph(card, () => { card.classList.add("noting"); card.querySelector(".nx-note").hidden = false; }, { duration: 280, fade: card.querySelector(".nx-note") }); card.querySelector("#nx-note-in").focus({ preventScroll: true }); return; }
  if (t.closest("[data-nx-send]")) { nextDecide("deny", $("#nx-note-in").value); return; }
  if (t.closest("[data-nx-cancel]")) { const card = $("#hm-next .next"); morph(card, () => { card.classList.remove("noting"); card.querySelector(".nx-note").hidden = true; }, { duration: 260 }); card.focus({ preventScroll: true }); return; }
  const r = t.closest("[data-retry]");
  if (r) { retry(r.dataset.retry); return; }
  // Interrupt goes as its turn stops: focus lands on its Undo (3 s), drawn in the same step (Astra RUN-5)
  if (t.closest("[data-interrupt]")) { S.focusNext = [() => heraldBox()?.querySelector("[data-herald-undo]")]; interruptRun(convAt(t).view); return; }
  const ed = t.closest("[data-edit]");
  if (ed) { editFailed(ed.dataset.edit, composerAt(ed)); return; }
  const mx = t.closest("[data-mx]");
  if (mx) { openMedia(mx, e); return; }
  if (t.closest("[data-lref-x]")) { delete S.lref[S.view]; lrefRender(); say.focus(); return; }
  const lr = t.closest("[data-ref]");
  if (lr) { e.preventDefault(); openLineRef(lr); return; }
  // a changed file's chip: its diff in the panel's Changes; anything else (a link to a file), Files
  const cf = t.closest(".tb-cf[data-file]");
  // opening it is reading here, as opening a work fold is: the view unpins on this row, so the panel making
  // room (the conversation narrows and re-wraps) moves nothing you're reading
  if (cf) {
    const cv = convAt(cf), c = CHG.forTarget(cv.view, cf.dataset.file);
    if (c) {
      cv.follow.unpin(cf); // the row you clicked in stays where it is while the panel takes its room (follow.js)
      const s = CHG.scope(cv.view);
      const inFiles = () => VW.open({ path: c.path, name: c.path.split("/").pop(), project: s.project, rel: s.worktree ? `.xo/worktrees/${s.worktree}/${c.path}` : c.path, show: "changes" }, cf);
      // ⌘/Ctrl-click: its diff in the panel's Files page, as the file (the same place a file opens)
      if (s && (e.metaKey || e.ctrlKey)) { inFiles(); return; }
      // its diff in the panel's Changes: focus goes to its row there, in the draw that shows it (the chip you
      // pressed is redrawn as chosen, and on a phone the panel covers it) (Files/Map grader on S224)
      if (STAGE.showChange(c.path)) { S.focusNext = [`#stage [data-cx="${CSS.escape(c.path)}"]`, "#stage .cx-pd"]; schedule(); return; }
      // a shape without the panel's Changes (Make content): its diff in Files instead
      if (s) { inFiles(); return; }
    }
  }
  const fb = t.closest("[data-file]");
  if (fb) { e.preventDefault(); openSharedFile(fb); return; }
  const cp = t.closest("[data-copy]");
  // "Copied" only once it's on the clipboard; refused, said so, and focus stays on the button
  // each Copy owns its answer: only the newest on this button says "Copied" and only its own timer puts "Copy" back;
  // an older one answering late says nothing; a refusal clears the check (Astra C052: an older reset wiped a newer
  // acknowledgement)
  if (cp) {
    const my = (cp._copyN = (cp._copyN || 0) + 1);
    copyText(cp.closest(".md-code")?.querySelector("code")?.textContent || "").then((ok) => {
      if (cp._copyN !== my) return;
      clearTimeout(cp._copyT);
      // what's said is this Copy's too: a newer one answering within the live region's 40 ms keeps it unsaid
      const mine = () => cp._copyN === my;
      if (!ok) { cp.textContent = "Copy"; announce(COPY_REFUSED, mine); return; }
      cp.textContent = "Copied"; announce("Copied the code.", mine);
      cp._copyT = setTimeout(() => { if (cp._copyN === my) cp.textContent = "Copy"; }, 1400);
    });
  }
});
$("#home").addEventListener("keydown", (e) => {
  if (e.target.id === "nx-note-in") {
    if (e.isComposing || e.keyCode === 229) return; // a word being composed owns its keys: Enter and Escape too
    // Enter while a word is still being composed (an IME) finishes the word; it never sends (Astra DEC-HOME-IME)
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); e.stopPropagation(); nextDecide("deny", e.target.value); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); $("[data-nx-cancel]").click(); }
    return;
  }
  // on the focused Home card: 1–9 answer, A allows a routine glance, D sends back, E details
  const card = e.target.closest?.(".next");
  if (!card || e.target !== card || e.metaKey || e.ctrlKey || e.altKey) return;
  // a key held down repeats: a repeat never decides anything, here as on a decision card (Astra DEC-HOME-REPEAT)
  if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
  const n = homeParts().next;
  if (!n || n.key !== card.dataset.key) return;
  if (/^[1-9]$/.test(e.key) && Array.isArray(n.ask.options) && !Kit.isBinary(n.ask) && n.effort === "glance") { const o = n.ask.options[+e.key - 1]; if (o != null) { e.preventDefault(); e.stopPropagation(); nextDecide({ option: o }); } }
  else if (K.is(e, "allow") && Kit.isBinary(n.ask) && n.effort === "glance") { e.preventDefault(); e.stopPropagation(); nextDecide("allow"); }
  else if (K.is(e, "back") && n.effort === "glance") { e.preventDefault(); e.stopPropagation(); card.querySelector("[data-nx-back]")?.click(); }
  else if (K.is(e, "details") || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); decideKey(n.key); }
});
function openNext() {
  const P0 = homeParts();
  if (!P0.next) { heraldShow({ kind: "calm", text: "Nothing needs you right now" }, 2400); return; }
  decideKey(P0.next.key);
}

// ── One state per thread, in one vocabulary ─────────────────────────────────
/** Needs you · Working · Waiting · Done, from what XO knows: an open ask on it, its agent at work right now,
 *  finished (done, resolved, stopped, frozen), else waiting (idle, paused, held). */
const STATE_WORDS = { needs: "Needs you", working: "Working", waiting: "Waiting", done: "Done" };
function threadState(t, needs) {
  if (needs.some((n) => n.t.id === t.id && n.admitted && n.group !== "stopped")) return "needs";
  if (t.frozen || t.state === "done" || t.state === "resolved" || t.state === "failed" || t.state === "stopped") return "done";
  if (isBusy(t)) return "working";
  return "waiting";
}
/** The panel's Threads: the place's threads (a thread's view: its project's), grouped in that order, the
 *  coordinator first when it asks or works. A working row says what it's doing now (the Map's own line), the
 *  rest what they did (Space's one-line summary) or their state. */
function panelThreads(v) {
  const pid = convProject(v);
  if (!pid) return [];
  const needs = D.needItems();
  const doing = new Map(MAP.agents(pid === "workspace" ? "ws" : "p:" + pid).map((a) => [a.go, a]));
  const groups = { needs: [], working: [], waiting: [], done: [] };
  // the coordinator: not a thread, but what it asks counts in "need you" everywhere, so it's here too
  const coordAsks = needs.filter((n) => n.t.host && n.t.project === pid && n.admitted);
  const coordGo = pid === "workspace" ? "ws" : "p:" + pid, coordAg = doing.get(coordGo);
  if (coordAsks.length || coordAg) {
    const st = coordAsks.length ? "needs" : "working";
    groups[st].push({ go: coordGo, coord: true, title: pid === "workspace" ? "Workspace coordinator" : "Coordinator", state: st, word: STATE_WORDS[st],
      sub: coordAsks.length ? askShort(coordAsks[0]) : coordAg.doing, since: st === "working" ? coordAg.since : null, color: coordAg?.color, on: v === coordGo });
  }
  const ts = world.state.threads.filter((t) => t.project === pid).sort((a, b) => b.lastAt - a.lastAt);
  for (const t of ts) {
    const st = threadState(t, needs), ag = doing.get("t:" + t.id);
    const ask = st === "needs" ? needs.find((n) => n.t.id === t.id) : null;
    groups[st].push({ go: "t:" + t.id, title: t.title, state: st, word: STATE_WORDS[st], mark: threadMark(t), summary: t.summary || "", branch: t.branch || "",
      sub: st === "working" && ag ? ag.doing : ask ? askShort(ask) : t.stop ? stopWords(t.stop) : t.summary || (t.state === "failed" ? "Stopped" : t.state === "resolved" ? "Resolved" : isHeld(t) ? heldWords(t.held) : STATE_WORDS[st]),
      since: st === "working" && ag ? ag.since : null, at: st === "working" ? "" : short(t.lastAt), color: ag?.color, on: v === "t:" + t.id });
  }
  return ["needs", "working", "waiting", "done"].filter((k) => groups[k].length).map((k) => ({ k, word: STATE_WORDS[k], rows: groups[k] }));
}

// ── All threads: searchable, filtered; finished ones fold into one line ────
const allEl = $("#all");
let allReturn = null;
function allRender() {
  const pid = convProject(S.view);
  const q = $("#all-q").value.trim().toLowerCase();
  const needs = D.needItems();
  const ts = world.state.threads.filter((t) => t.project === pid);
  // "Working" means its agent is working right now (isBusy), nothing else: an open thread whose agent
  // sits idle, or one paused or waiting, is "Waiting" (audit: a Working filter listed 6 idle threads)
  // the panel's four states (threadState): one vocabulary everywhere
  const cat = (t) => threadState(t, needs);
  const counts = { all: ts.length, needs: 0, working: 0, waiting: 0, done: 0 };
  for (const t of ts) { const c = cat(t); if (counts[c] != null) counts[c]++; }
  allFilterRender(counts);
  $("#all-h").textContent = `All ${SHAPE.word("threads")} · ${PROJ(pid)}`;
  $("#all-h").title = SHAPE.word("threads") === "threads" ? "" : "XO's word: threads";
  $("#all-q").placeholder = `Search ${SHAPE.word("threads")}`;
  // title, summary and branch, every word (the panel's filter matches the same)
  let list = ts.filter((t) => { if (!q) return true; const s = `${t.title} ${t.summary || ""} ${t.branch || ""}`.toLowerCase(); return q.split(/\s+/).every((w) => s.includes(w)); });
  if (S.allFilter !== "all") list = list.filter((t) => cat(t) === S.allFilter);
  const order = { needs: 0, working: 1, waiting: 2, done: 3 };
  list.sort((a, b) => order[cat(a)] - order[cat(b)] || b.lastAt - a.lastAt);
  const row = (t) => {
    const c = t.checklist;
    const k = cat(t);
    const mk = threadMark(t);
    return `<li><button type="button" class="ar st-${k}${mk ? " has-mk" : ""}" data-go="t:${esc(t.id)}">${stateMark(k === "needs" ? "needs_reply" : glyphOf(t))}<span class="ar-tl"><span class="ar-t">${esc(t.title)}</span>${t.label ? `<span class="ar-l">${esc(t.label)}</span>` : ""}</span><span class="ar-s">${rtTag(t, "ar")}${STATE_WORDS[k]}</span><span class="mini" aria-label="${c.done} of ${c.total}"><i style="--p:${c.total ? c.done / c.total : 0}"></i></span><span class="ar-a"><span>${esc(short(t.lastAt))}</span>${mk ? `<span class="ar-mk">${mk}</span>` : ""}</span></button></li>`;
  };
  const fold = S.allFilter === "all" && !q;
  const liveL = fold ? list.filter((t) => cat(t) !== "done") : list;
  const done = fold ? list.filter((t) => cat(t) === "done") : [];
  let html = liveL.length ? `<ul class="ar-list">${liveL.map(row).join("")}</ul>` : "";
  if (done.length) html += `<div class="ar-done${S.allDone ? " is-open" : ""}"><button type="button" class="ar-fold" data-all-done aria-expanded="${S.allDone}">${ICON.check}<span><b>${done.length} done</b>${done.some((t) => t.state === "resolved") ? " or resolved" : ""}</span>${ICON.chevron}</button><div class="ar-db"${S.allDone ? "" : " hidden"}><div class="ar-di"><ul class="ar-list">${done.map(row).join("")}</ul></div></div></div>`;
  if (!html) html = `<p class="ar-none">Nothing matches “${esc(q)}”.</p>`;
  redraw($("#all-list"), html); // in place: a row that stays is the same node
}
/**
 * The filter: one radio group, drawn once and then updated in place, so the option you chose (by a click, Space,
 * or the arrows: keynav.js) is the same element afterwards and keeps focus. Only the chosen one is in the Tab
 * order. An empty filter can't be chosen, except the one already chosen (it stays reachable while it empties).
 */
const ALL_F = [["all", "All"], ["needs", "Needs you"], ["working", "Working"], ["waiting", "Waiting"], ["done", "Done"]];
function allFilterRender(counts) {
  const box = $("#all-f");
  if (box.children.length !== ALL_F.length) box.innerHTML = ALL_F.map(([k, w]) => `<button type="button" role="radio" data-af="${k}">${w}<span></span></button>`).join("");
  for (const b of box.children) {
    const k = b.dataset.af, on = S.allFilter === k, n = String(counts[k]);
    if (b.getAttribute("aria-checked") !== String(on)) b.setAttribute("aria-checked", String(on));
    if (b.tabIndex !== (on ? 0 : -1)) b.tabIndex = on ? 0 : -1;
    b.disabled = !on && k !== "all" && !counts[k];
    if (b.lastChild.textContent !== n) b.lastChild.textContent = n;
  }
}
radioKeys($("#all-f"));
/** The thread's ⋯ (the owner, 19 Nov): one menu for everything a thread can do, only what fits its state now.
 *  Previous / next go through the place's threads in the panel's order; Stop only while it works; Copy branch
 *  name only with a branch; Delete only where Space can delete a thread (t.canDelete), asked in place. */
function threadSiblings(t) {
  const list = panelThreads("t:" + t.id).flatMap((g) => g.rows).filter((r) => !r.coord).map((r) => r.go);
  const i = list.indexOf("t:" + t.id);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}
/** The thread's ⋯ menu: ONE menu, the full header's and the panel's Thread page's (the owner, 19 Nov 18:59Z: "why
 *  can't i have the same menu on the side thing?"): the same items, hover (pointerFollows), keys (menuKeys) and code.
 *  where: "main" or "page"; the one item that differs is the way to its other place. */
function threadMenuHtml(t, where = "main") {
  const sib = threadSiblings(t), item = (attrs, words, off = false) => `<button type="button" role="menuitem" ${attrs}${off ? ' aria-disabled="true"' : ""}>${words}</button>`;
  const sep = '<span class="tw-sep" role="separator"></span>';
  const groups = [
    [item(`data-tgo="${esc(sib.prev || "")}"`, "Previous thread", !sib.prev), item(`data-tgo="${esc(sib.next || "")}"`, "Next thread", !sib.next),
      where === "page" ? item(`data-tp-main="${esc(t.id)}"`, "Open in main chat") : item(`data-tside="${esc(t.id)}"`, "Open beside its project's chat")],
    [SH.enabled ? item(`data-shell="t:${esc(t.id)}"`, "Open a shell in its worktree") : "",
      t.branch ? item(`data-tcopy="${esc(t.branch)}"`, "Copy branch name") : ""],
    [item('data-tfield="title"', "Rename"), item('data-tfield="label"', t.label ? "Change label" : "Add a label"), t.label ? item('data-tfield="clear-label"', "Remove the label") : "",
      movable(t) ? item(`data-tmove="${esc(t.id)}"`, "Continue on another runtime…") : "",
      isBusy(t) ? item("data-chat-stop", "Stop") : ""],
    [t.canDelete ? item(`data-tdel="${esc(t.id)}" class="tw-danger"`, "Delete thread…") : ""],
  ].map((g) => g.filter(Boolean).join("")).filter(Boolean);
  return `<span class="tw-menu" role="menu" tabindex="-1">${groups.join(sep)}</span>`;
}
/** Delete, asked in place: what goes (its messages, its transcript, its worktree folder), what stays (its branch),
 *  for how long it can be undone; Keep it first. When Space says work would be lost, it names it and the button
 *  says so ("Delete anyway"). */
function tdelRender(t) {
  const box = $("#tdel");
  const on = !!(t && S.tDel === t.id);
  box.hidden = !on;
  if (!on) { if (box._h) { box.innerHTML = ""; box._h = ""; } return; }
  const lose = S.tDelLose;
  const html = `<div class="wt-confirm" role="alertdialog" aria-labelledby="tdel-q"><p class="wt-q" id="tdel-q"><b>Delete “${esc(t.title)}”?</b> Its messages and transcript go, and its worktree folder is removed. You can undo it for a few seconds.</p>` +
    (t.branch ? `<div class="wt-loss"><p>Its branch <code>${esc(t.branch)}</code> is kept${t.git && t.git.ahead ? `, ${t.git.ahead} commit${t.git.ahead === 1 ? "" : "s"} ahead of where it started` : ""}.</p></div>` : "") +
    (lose ? `<div class="wt-loss"><p><b>${esc(lose.summary || "Work that isn't kept anywhere else")}</b></p></div>` : "") +
    `<div class="set-fa"><button type="button" class="btn" data-tdel-no>Keep it</button><button type="button" class="btn btn-danger" data-tdel-yes="${esc(t.id)}"${busyAttrs(`tdel:${t.id}`)}>${lose ? "Delete anyway" : "Delete thread"}</button></div></div>`;
  if (box._h !== html) { redraw(box, html); box._h = html; }
}
async function deleteThread(tid) {
  const t = world.thread(tid);
  if (!t || !world.act.deleteThread) return;
  const pid = t.project;
  try {
    if (isPending(`tdel:${tid}`)) return; // already on its way
    const p = once(`tdel:${tid}`, () => world.act.deleteThread(tid, { keepBranch: true, confirm: S.tDelLose?.confirm || null }));
    render();
    const res = await p;
    S.tDel = null; S.tDelLose = null;
    go("p:" + pid);
    heraldShow({ kind: "done", text: `“${t.title}” deleted`, sub: t.branch ? `Its branch ${t.branch} is kept` : PROJ(pid),
      undo: () => world.act.restoreThread(tid, res.row).then(() => announce("Thread back"), () => heraldShow({ kind: "stopped", text: "Couldn't bring it back", sub: t.title, force: true }, 6000)),
      undoUntil: res.undo_until ? Date.parse(res.undo_until) : Date.now() + 10000, ownFocus: true }, 10000);
  } catch (err) {
    // work kept nowhere else: say what, and ask again (the next press sends Space's confirm token)
    if (err && err.code === "would_lose_work") { S.tDelLose = { summary: err.what?.summary || null, confirm: err.confirm || err.what?.confirm || null }; $("#top-who")._h = null; render(); return; }
    heraldShow({ kind: "stopped", text: "Couldn't delete the thread", sub: String(err && err.message || err), force: true }, 6000);
  }
}
/** The panel's Shell: the shells' own dock moved into the panel (the same sessions and tabs as under the page), a
 *  shell opened for where you are (a thread's worktree, a project's folder, the workspace). Off, it goes back under
 *  the page, put away. Put away from inside the panel (its own ↓), the panel goes back to its frames. */
const SHD_HOME = { parent: $("#shd").parentNode, next: $("#shd").nextSibling };
function panelShell(on, host, where) {
  const d = $("#shd");
  if (on) {
    if (!SH.enabled) { STAGE.shellOff(); heraldShow({ kind: "calm", text: "Shells aren't on here" }, 3200); return; }
    host.append(d); d.classList.add("in-panel");
    const at = where || S.view;
    // one that couldn't open goes back
    Promise.resolve(openShell(at.startsWith("t:") || at.startsWith("p:") ? at : "ws")).then(() => { if (STAGE.isShell && d.hidden) STAGE.shellOff(); }, () => { if (STAGE.isShell) STAGE.shellOff(); });
  } else {
    d.classList.remove("in-panel");
    SHD_HOME.parent.insertBefore(d, SHD_HOME.next);
    SH.hide();
  }
}
new MutationObserver(() => { if (STAGE.isShell && $("#shd").hidden) STAGE.shellOff(); }).observe($("#shd"), { attributes: true, attributeFilter: ["hidden"] });
/** A Shell button: "ws", "p:<project folder>" or "t:<thread>" (its worktree, else the project's folder). */
function openShell(where) {
  if (where === "ws") return SH.openWorkspace();
  if (where.startsWith("p:")) return SH.openProject(where.slice(2));
  const t = world.thread(where.slice(2));
  if (t) SH.openThread({ project: t.project, chatId: t.chatId, ts: t.id, title: t.title });
}
/** All threads: from the project's title it drops down under it (the thread switcher); elsewhere a sheet. */
function openAll(anchor = null) {
  if (!convProject(S.view) || convProject(S.view) === "workspace") return;
  allReturn = document.activeElement;
  const drop = !!anchor && !PHONE.matches;
  allEl.classList.toggle("is-drop", drop);
  if (drop) {
    // under its button, its right edge on the button's
    const r = anchor.getBoundingClientRect();
    const w = Math.min(480, innerWidth - 32);
    allEl.style.setProperty("--dx", `${Math.max(16, Math.round(r.right - w))}px`);
    allEl.style.setProperty("--dy", `${Math.round(r.bottom + 8)}px`);
    allEl.style.setProperty("--dw", `${w}px`);
  }
  S.allFilter = "all"; S.allDone = false;
  $("#all-q").value = "";
  allRender();
  allEl.hidden = false;
  $("#all-q").focus();
  schedule();
}
/** All closes back to what opened it; if that control has gone meanwhile (the +N, once everything fits), to the
 *  switcher that's shown now, never the page. */
function closeAll() {
  if (allEl.hidden) return;
  allEl.hidden = true; syncInert();
  const shown = (el) => el && el.isConnected && el.getClientRects().length > 0;
  const back = shown(allReturn) ? allReturn : [...document.querySelectorAll("[data-switch]")].find(shown);
  back?.focus({ preventScroll: true });
  schedule();
}
$("#all-q").addEventListener("input", allRender);
// The switcher's keys, in one place so a key takes one step (Astra H31: ↓ from the search moved two): from the
// search, ↓ goes to the first thread and Enter opens it; on the list, ↓ ↑ walk it and ↑ from the first is the
// search again. An IME composing in the search owns its keys (H32: its Enter opened a thread).
allEl.addEventListener("keydown", (e) => {
  if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; } // the IME's keys, not the switcher's or the page's
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const inSearch = e.target === $("#all-q");
  // the same keys as the panel's filter: / goes to the search, Esc in it clears it before it closes anything
  if (e.key === "/" && !inSearch && !e.target.closest?.("input, textarea, [contenteditable]")) { e.preventDefault(); e.stopPropagation(); $("#all-q").focus(); $("#all-q").select(); return; }
  if (e.key === "Escape" && inSearch && $("#all-q").value) { e.preventDefault(); e.stopPropagation(); $("#all-q").value = ""; allRender(); return; }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && !(inSearch && e.key === "Enter")) return;
  const rows = [...allEl.querySelectorAll(".all-list [data-go]")].filter((b) => b.offsetParent);
  if (inSearch) {
    if (!rows.length || e.key === "ArrowUp") return;
    e.preventDefault();
    if (e.key === "ArrowDown") rows[0].focus();
    else { allEl.hidden = true; go(rows[0].dataset.go); }
    return;
  }
  const i = rows.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  if (e.key === "ArrowUp" && i === 0) { $("#all-q").focus(); return; }
  rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))].focus();
});
allEl.addEventListener("click", (e) => {
  if (e.target === allEl || e.target.closest("[data-close]")) { closeAll(); return; }
  const f = e.target.closest("[data-af]");
  if (f) { S.allFilter = f.dataset.af; allRender(); return; }
  if (e.target.closest("[data-all-done]")) {
    const box = $(".ar-done");
    S.allDone = !S.allDone;
    box.querySelector(".ar-fold").setAttribute("aria-expanded", String(S.allDone));
    expand(box, box.querySelector(".ar-db"), S.allDone);
    return;
  }
  const g = e.target.closest("[data-go]");
  if (g) { allEl.hidden = true; go(g.dataset.go); }
});

// ── Create XO Project (js/create.js): start empty or clone a repository ─────
const CREATE = initCreate({
  world, S, go, heraldShow, announce, setDrawer,
  // On a phone the sidebar button that opened it is inside the closed drawer: return to the menu.
  onPhoneClose: () => { if (PHONE.matches) setTimeout(() => $("#pb-menu").focus({ preventScroll: true }), RM.matches ? 0 : 170); },
});
$("#side-add").addEventListener("click", CREATE.open);

// ── phone drawer ────────────────────────────────────────────────────────────
let drawerReturn = null;
function setDrawer(open) {
  if (!PHONE.matches && open) return;
  if (open) drawerReturn = document.activeElement;
  $("#app").classList.toggle("drawer", !!open);
  $("#side-scrim").hidden = !open;
  $("#pb-menu").setAttribute("aria-expanded", String(!!open));
  $("#top-menu").setAttribute("aria-expanded", String(!!open));
  syncInert();
  if (open) $("#nv-home").focus();
  else if ($("#side").contains(document.activeElement) || document.activeElement === document.body) {
    const back = [drawerReturn, $("#top-menu"), $("#pb-menu")].find((b) => b && b.isConnected && b.offsetParent && !b.closest("[inert]"));
    if (PHONE.matches) back?.focus({ preventScroll: true });
  }
}
$("#pb-menu").addEventListener("click", () => setDrawer(true));
$("#top-menu").addEventListener("click", () => setDrawer(true));
$("#side-x").addEventListener("click", () => setDrawer(false));
$("#side-scrim").addEventListener("click", () => setDrawer(false));

// ── jump (⌘K) ───────────────────────────────────────────────────────────────
const jump = $("#jump"), jq = $("#jump-q"), jl = $("#jump-list");
let jsel = 0, jitems = [];
/** A thread's icon in ⌘K: its state glyph, the one every list uses (the blue working arc while it works, amber
    when it needs you); no dot on a corner (the owner: no blue dots anywhere). */
function threadIc(t) {
  const n = D.needItems().some((x) => x.t.id === t.id && x.admitted);
  return `<span class="j-th">${stateMark(n ? "needs_reply" : glyphOf(t))}</span>`;
}
function jumpRender() {
  const q = jq.value.trim().toLowerCase();
  const all = [{ v: "home", name: "Home", sub: "Your next move", icon: ICON.home }, { v: "ws", name: "Workspace", sub: "The coordinator", icon: XO }, { v: "chats", name: "Chats", sub: "Ask anything, no project needed", icon: ICON.thread }, { v: "artifacts", name: "Artifacts", sub: "Everything your threads made", icon: ICON.stack }, { v: "launchpad", name: "Launchpad", sub: "Every project's app on the web", icon: ICON.deploy }];
  const needN = new Map();
  for (const x of D.needItems()) if (x.admitted && !x.later) needN.set(x.t.project, (needN.get(x.t.project) || 0) + 1);
  // typed for, the projects that need you come first
  const ps = q ? projects().sort((a, b) => needN.has(b.id) - needN.has(a.id)) : projects();
  for (const p of ps) {
    const n = needN.get(p.id) || 0;
    all.push({ v: "p:" + p.id, name: p.name, sub: n ? `Project · ${n} need${n === 1 ? "s" : ""} you` : "Project", icon: projectIcon(p.id) });
    for (const t of threadsOf(p.id)) all.push({ v: "t:" + t.id, name: t.title, sub: `${p.name} · ${wordOf(t).toLowerCase()}`, icon: threadIc(t), t: true });
  }
  // verbs, after the places and only when typed for: searching never runs one; Enter or a click does
  const light = document.documentElement.dataset.theme === "light";
  const verbs = q ? [
    { name: "New project…", sub: "Action", icon: ICON.plus, run: () => CREATE.open() },
    { name: "Settings", sub: "Action", icon: ICON.sliders, run: () => openSettings() },
    { name: "Keyboard shortcuts", sub: "Action", icon: ICON.sliders, run: () => openKeys() },
    { name: light ? "Dark mode" : "Light mode", sub: "Action", icon: light ? ICON.moon : ICON.sun, run: () => $("#theme").click() },
    ...(IQ.kindOf(sessionOf(S.view)) ? [{ name: "Intelligence: model and thinking", sub: "Action", icon: ICON.sliders, run: () => IQ.open(sessionOf(S.view), $("#iq")) }] : []),
    ...(!pageEl(S.view) ? [{ name: "Threads, Changes and Map", sub: "Action", icon: ICON.sliders, run: () => STAGE.toggle() }] : []),
  ].filter((x) => x.name.toLowerCase().includes(q)) : [];
  jitems = all.filter((x) => !q || (x.name + " " + x.sub).toLowerCase().includes(q)).concat(verbs, REC.jumpItems(q));
  jsel = Math.min(jsel, Math.max(0, jitems.length - 1));
  jl.innerHTML = jitems.map((x, i) => `<li role="option" id="j-${i}" aria-selected="${i === jsel}" data-i="${i}" class="${x.t ? "is-t" : ""}"><span class="j-ic">${x.icon}</span><span class="j-n">${esc(x.name)}</span><span class="j-s">${esc(x.sub)}</span></li>`).join("") || `<li class="j-none">Nothing matches “${esc(q)}”.</li>`;
  jq.setAttribute("aria-activedescendant", jitems.length ? `j-${jsel}` : "");
  jl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}
let jumpReturn = null;
/**
 * Focus an overlay that is opening. A native modal still closing (Create's 160 ms) holds focus until it lets go,
 * and then hands it back to whatever opened it: the overlay takes it now if it can, and again once the modal has
 * closed, so the person's keys land where they now look (Astra C020: Create, Esc, Ctrl+K at once).
 */
function focusOverlay(target) {
  target.focus({ preventScroll: true });
  const modal = [...document.querySelectorAll("dialog[open]")].find((d) => d.matches(":modal"));
  if (modal) modal.addEventListener("close", () => { if (target.isConnected && !target.closest("[hidden]")) target.focus({ preventScroll: true }); }, { once: true });
}
function openJump() { jumpReturn = document.activeElement; jump.hidden = false; jq.value = ""; jsel = 0; jumpRender(); focusOverlay(jq); }
function closeJump({ restore = true } = {}) { if (jump.hidden) return; jump.hidden = true; syncInert(); if (restore && jumpReturn && jumpReturn.isConnected && jumpReturn.offsetParent) jumpReturn.focus({ preventScroll: true }); }
jq.addEventListener("input", () => { jsel = 0; jumpRender(); });
jq.addEventListener("keydown", (e) => {
  // every key of a word being composed (an IME) is the word's: its arrows move among the candidates, Escape
  // cancels it, Enter finishes it; none of them moves the selection or closes Jump (Astra SRC-MAIN-IME-1)
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); jsel = (jsel + (e.key === "ArrowDown" ? 1 : jitems.length - 1)) % Math.max(1, jitems.length); jumpRender(); }
  // Enter while a word is being composed (an IME) finishes the word; with nothing found, Jump stays open on what
  // you typed (it never closes onto nothing: Astra, e20231c)
  if (e.key === "Enter") { e.preventDefault(); const x = jitems[jsel]; if (!x) { announce("Nothing matches. Change what you typed, or Esc to close."); return; } closeJump({ restore: !!x.run }); x.run ? x.run() : go(x.v); }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeJump(); }
});
// the row under a moving pointer becomes the selection, as the arrows make it (only on a real move: a list
// scrolling under a still pointer never steals the keyboard's row)
jl.addEventListener("pointermove", (e) => {
  const li = e.target.closest("[data-i]");
  if (!li || +li.dataset.i === jsel) return;
  jl.querySelector('[aria-selected="true"]')?.setAttribute("aria-selected", "false");
  jsel = +li.dataset.i; li.setAttribute("aria-selected", "true");
  jq.setAttribute("aria-activedescendant", li.id);
});
jl.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) { const x = jitems[+li.dataset.i]; closeJump({ restore: !!x.run }); if (x.run) x.run(); else go(x.v); } });
jump.addEventListener("mousedown", (e) => { if (e.target === jump) closeJump(); });

// ── one layer on top ──────────────────────────────────────────────────────────
// A sheet (Jump, Keys, All threads, Runs) is modal: everything under it is inert, so Tab and Shift+Tab stay in
// it and a key can't reach a control it covers. Settings covers the main area but not the sidebar: only the
// main area's other parts go inert, and the sidebar stays a way out. One observer keeps it true however a
// layer opens or closes.
function syncInert() {
  // only what this set inert is released here: Files keeps its own inert parts (a railed or folded chat)
  const hold = (el, on) => { if (on && !el.inert) { el.inert = true; el.dataset.layerInert = ""; } else if (!on && "layerInert" in el.dataset) { el.inert = false; delete el.dataset.layerInert; } };
  hold($("#app"), [jump, keys, allEl, QO.el].some((el) => !el.hidden));
  const settings = !setEl.hidden;
  for (const el of $("#main").children) if (el !== setEl && !el.classList.contains("toast-wrap")) hold(el, settings);
  // a phone: the sidebar is a drawer; closed, it is off screen and out of reach; open, it covers the main area
  const drawer = $("#app").classList.contains("drawer");
  hold($("#side"), PHONE.matches && !drawer);
  hold($("#main"), PHONE.matches && drawer);
}
queueMicrotask(() => { PHONE.addEventListener("change", syncInert); const mo = new MutationObserver(syncInert); for (const el of [jump, keys, allEl, setEl]) mo.observe(el, { attributes: true, attributeFilter: ["hidden"] }); syncInert(); });
/** The layer that holds the keyboard, the page behind it inert (syncInert): a sheet; on a phone, Settings (it covers
 *  the whole screen there), else the open drawer (the sidebar, over the main area). Null when the page itself does. */
function keyLayer() {
  return [keys, allEl, jump].find((el) => !el.hidden) || (PHONE.matches && !setEl.hidden ? setEl : null)
    || (PHONE.matches && $("#app").classList.contains("drawer") ? $("#side") : null);
}
// Tab and Shift+Tab go round the open layer: past its last control is its first, never the page behind it (inert,
// so Tab fell to BODY: the create-project/Launchpad grader on c055e74, the phone's drawer past Settings).
// It listens as the event bubbles, after the control the keys are in: a control that takes Tab for itself (Edit as
// JSON indents with it) claims it with preventDefault, and the layer only turns round a Tab nobody claimed.
addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.defaultPrevented) return;
  const top = keyLayer();
  if (!top) return;
  // what Tab itself would visit: anything in the tab order (a summary, a field, a link, a roving group's one stop),
  // drawn and usable; the browser moves between them, and this only turns it round at the sheet's two ends
  const f = [...top.querySelectorAll("*")].filter((x) => x.tabIndex >= 0 && !x.disabled && !x.closest("[inert]") && x.getClientRects().length > 0);
  if (!f.length) return;
  const a = document.activeElement, inside = top.contains(a);
  const after = inside && f.some((x) => x !== a && a.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
  const before = inside && f.some((x) => x !== a && x.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (e.shiftKey ? !before : !after) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
});

// ── keys sheet ──────────────────────────────────────────────────────────────
const keys = $("#keys");
/** The Sounds switch, and under it what its last press found: a browser that won't play, or won't remember. */
function soundRender(said = null) {
  const tog = $("#sound-tog");
  tog.setAttribute("aria-checked", String(sound.on));
  const row = tog.closest(".set-row");
  let note = row && row.nextElementSibling && row.nextElementSibling.matches(".sound-note") ? row.nextElementSibling : null;
  if (said == null) { note?.remove(); return; }
  if (!note && row) { note = document.createElement("p"); note.className = "set-note sound-note"; note.setAttribute("role", "status"); row.after(note); }
  if (note) note.textContent = said;
}
// a press turns them on or off, there and then; the switch says what is so, and why when it isn't what was asked
$("#sound-tog").addEventListener("click", async () => {
  const tog = $("#sound-tog");
  if (tog.getAttribute("aria-busy") === "true") return;
  tog.setAttribute("aria-busy", "true");
  const want = !sound.on;
  const r = await sound.turn(want);
  tog.removeAttribute("aria-busy");
  const said = r.refused ? "This browser won't play sound here, so sounds stay off."
    : r.kept ? null
    : want ? "This browser won't remember sounds here, so they stay off."
    : "Sounds are off for now: this browser won't remember it after a reload.";
  soundRender(said);
  if (said) announce(said);
  if (r.on) sound.play("allow");
});
// a switch says on or off; its label says what (no glyph in the knob)
function hopsRender() { $("#hops-tog").setAttribute("aria-checked", String(!!S.showHops)); }
function webpicsRender() { $("#webpics-tog").setAttribute("aria-checked", String(SHAPE.on(WEBPICS))); }
/**
 * What a General switch's change did, said truthfully: done, it's announced; refused (a newer XO saved this
 * device's layer, which this one won't overwrite), the switch stays as it was and the reason shows under its words;
 * applied but not kept (this browser's storage refused it), it says that under its words instead of "done".
 */
function deviceSaid(tog, r, done) {
  const l = tog.closest(".set-row").querySelector(".set-l");
  let why = l.querySelector(".set-err");
  const say = r && r.error ? r.error : r && r.kept === false ? UNKEPT : null;
  if (say) {
    if (!why) { why = document.createElement("p"); why.className = "set-err"; why.setAttribute("role", "alert"); l.append(why); }
    why.textContent = say;
    return;
  }
  why?.remove();
  announce(done);
}
$("#webpics-tog").addEventListener("click", (e) => {
  // this device's layer of the shape: a picture's site learns someone looked, so each device decides
  const on = !SHAPE.on(WEBPICS);
  deviceSaid(e.currentTarget, SHAPE.setDevice({ surfaces: { [WEBPICS]: { on } } }), on ? "Pictures from the web show in the conversation." : "Pictures from the web show as links.");
});
// Settings › Appearance › Mode and Flavour: this device's (localStorage cv-theme and cv-flavour, read before the first paint)
const MODES = [["dark", "Dark"], ["light", "Light"], ["system", "System"]];
const LOOKS = [[STONE.id, STONE.name], ...FLAVOURS.map((f) => [f.id, f.name])];
$("#mode-seg").innerHTML = MODES.map(([v, n]) => `<button type="button" role="radio" aria-checked="false" data-mode="${v}">${esc(n)}</button>`).join("");
// each flavour a card with its own swatch (css/flavours.css paints .fl-sw in the mode that's on)
$("#flavour-seg").innerHTML = LOOKS.map(([v, n]) => `<button type="button" class="set-choice fl-opt" role="radio" aria-checked="false" data-flavour="${v}"><span class="fl-sw" data-sw="${v}" aria-hidden="true"></span><span class="fl-n">${esc(n)}</span></button>`).join("");
radioKeys($("#mode-seg")); radioKeys($("#flavour-seg"));
function lookSync() {
  for (const [id, now] of [["#mode-seg", THEME.pref()], ["#flavour-seg", THEME.flavour()]]) {
    for (const b of $(id).querySelectorAll('[role="radio"]')) { const on = (b.dataset.mode || b.dataset.flavour) === now; b.setAttribute("aria-checked", String(on)); b.classList.toggle("is-on", on); b.tabIndex = on ? 0 : -1; }
  }
}
function lookSet(key, v) {
  let kept = true;
  try { localStorage.setItem(key, v); } catch { kept = false; }
  applyTheme(THEME.get());
  lookSync();
  return { kept };
}
$("#mode-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (b) deviceSaid(b, lookSet("cv-theme", b.dataset.mode), `${MODES.find(([v]) => v === b.dataset.mode)[1]} mode`);
});
$("#flavour-seg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-flavour]");
  if (b) deviceSaid(b, lookSet("cv-flavour", b.dataset.flavour), `${LOOKS.find(([v]) => v === b.dataset.flavour)[1]} flavour`);
});
lookSync();
// Settings › Appearance › Chat bubbles: this device's choice (localStorage cv-bubbles, read before the first paint in
// index.html). Off (the default), the conversation reads as a document; on, in bubbles (css/msgx.css keys off
// <html data-msgx="bubbles"> and data-msgx-tails). Nothing is redrawn: the same rows take the other look.
const chatBubbles = () => document.documentElement.dataset.msgx === "bubbles";
function setChatBubbles(on) {
  const r = document.documentElement;
  if (on) { r.dataset.msgx = "bubbles"; r.dataset.msgxTails = ""; } else { delete r.dataset.msgx; delete r.dataset.msgxTails; }
  let kept = true;
  try { localStorage.setItem("cv-bubbles", on ? "on" : "off"); } catch { kept = false; }
  return { on, kept };
}
function bubblesRender() { $("#bubbles-tog").setAttribute("aria-checked", String(chatBubbles())); }
$("#bubbles-tog").addEventListener("click", (e) => {
  const r = setChatBubbles(!chatBubbles());
  bubblesRender();
  deviceSaid(e.currentTarget, r, r.on ? "Messages show in bubbles." : "Replies read as full-width documents.");
});
bubblesRender();
$("#hops-tog").addEventListener("click", (e) => {
  // this device's layer of the shape (xo:thread/hops), where cv-hops was folded in; the shape's change redraws
  const on = !S.showHops;
  deviceSaid(e.currentTarget, SHAPE.setDevice({ surfaces: { "xo:thread/hops": { on } } }), on ? "Showing how messages travel." : "Hiding how messages travel.");
});
hopsRender();
keys.addEventListener("click", (e) => { if (e.target === keys || e.target.closest("[data-close]")) closeKeys(); });
let keysReturn = null;
function openKeys() { keysSheetRender(); keysReturn = document.activeElement; keys.hidden = false; focusOverlay(keys.querySelector("[data-close]")); }
function closeKeys() { keys.hidden = true; syncInert(); keysReturn?.focus?.({ preventScroll: true }); }

// ── settings: a page over the main area; closing it returns exactly where you were ──
const setEl = $("#settings");
let setReturn = null;
const SETS = createSettings({ world, announce, PROJ, onChange: () => schedule() });
const RTSET = createRuntimeSettings({ world, announce, PROJ });
const ACCTS = createAccounts({ announce });
// Settings › Shape and the page's own reading of the shape (density, work, rail)
const SV = createShapeView({ shape: SHAPE, announce, notice: (n) => heraldShow({ kind: "stopped", text: n.text, sub: n.sub, force: true }) });
/** The shape changed (only ever by the person's choice): everything that reads it is drawn again, now. */
function shapeApply({ boot = false } = {}) {
  SV.apply();
  setWorkMode(SHAPE.opts("xo:thread/work").mode);
  hopsRender();
  webpicsRender();
  if (boot) return; // the first render draws the rest
  if (S.showHops) { const t = convThread(S.view); if (t && world.act.loadHops) world.act.loadHops(t.id); else if (!t) loadChatHops(S.view); }
  SH.redraw();
  STAGE.reshape();
  schedule();
}
SHAPE.onChange(() => shapeApply());
shapeApply({ boot: true });
/** F5: wait for the limit, or move every waiting thread, from the card on a thread (the same item as in Needs you). */
async function decideLimit(id, decision) {
  S.limitBusy = id; S.limitErr = null; schedule();
  try {
    await world.act.decideItem(id, { decision });
    announce(decision === "move" ? "Moving the waiting threads. Each one says where it went." : "They wait for the limit to open.");
  } catch (err) { S.limitErr = { id, text: err.gone ? "It was already decided, or the limit opened." : err.message }; }
  S.limitBusy = null; schedule();
}
/** Pick a continued thread back up (F4): it un-freezes; sending a message in it does the same. */
async function unfreeze(tid, btn) {
  const th = world.thread(tid);
  if (!th || btn?.getAttribute("aria-busy") === "true") return;
  // aria-disabled while it asks (a disabled button drops focus to the page); picked up, its button goes with the
  // frozen state: focus goes to the message box, to write to it; refused, it stays on the button (Astra RUN-5)
  if (btn) { btn.setAttribute("aria-disabled", "true"); btn.setAttribute("aria-busy", "true"); }
  try {
    await world.act.editThread(th.id, { paused: false });
    if (btn && btn.isConnected && btn === document.activeElement) { const K = composerAt(btn); S.focusNext = [() => K.say, () => K.conv.scroller]; }
    announce("Picked back up. Its agent can carry on here.");
    schedule();
  } catch (err) { announce(`Couldn't pick it back up: ${err.message}`); if (btn) { btn.removeAttribute("aria-disabled"); btn.removeAttribute("aria-busy"); } }
}
function setPage(id) {
  // the rail is a tablist: only the chosen tab is in the Tab order (arrows move between them), Tab goes on into its page
  // Settings' own pages only
  for (const b of setEl.querySelectorAll("[data-set]")) { const on = b.dataset.set === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
  for (const p of setEl.querySelectorAll("[data-page]")) p.hidden = p.dataset.page !== id;
  SETS.open(id);
  if (id === "runtimes") RTSET.open();
  if (id === "accounts") ACCTS.open();
  if (id === "shape") SV.open();
}
function openSettings() {
  if (!setEl.hidden) return;
  // the layers Settings takes the place of close first (a phone's drawer hands the keyboard back to its menu):
  // where the keyboard is then is where closing Settings returns it
  setDrawer(false);
  if (D.isOpen()) D.close();
  IQ.close({ restore: false });
  setReturn = document.activeElement;
  setEl.hidden = false;
  $("#set-side").classList.add("is-on");
  $("#set-side").setAttribute("aria-expanded", "true");
  const first = setEl.querySelector('[aria-selected="true"]');
  if (first) focusOverlay(first);
}
function closeSettings({ restore = true } = {}) {
  if (setEl.hidden) return;
  if (S.recording) { S.recording = null; keysPageRender(); }
  setEl.hidden = true;
  syncInert();
  $("#set-side").classList.remove("is-on");
  $("#set-side").setAttribute("aria-expanded", "false");
  // back where you were, if it can take the keyboard (there, drawn, not inert, not disabled); else the composer
  const takes = (el) => !!el && el !== document.body && el.isConnected && el.getClientRects().length > 0 && !el.closest("[inert]") && !el.disabled;
  if (restore) [setReturn, say].find(takes)?.focus({ preventScroll: true });
}
$("#set-side").addEventListener("click", () => (setEl.hidden ? openSettings() : closeSettings()));
$("#set-phone").addEventListener("click", openSettings);
$("#set-x").addEventListener("click", () => closeSettings());
for (const b of $$("[data-set]")) b.addEventListener("click", () => setPage(b.dataset.set));
/** A link into one Settings page (a thread's runtime name opens Runtimes). */
document.addEventListener("click", (e) => { const b = e.target.closest("[data-set-open]"); if (b) { setPage(b.dataset.setOpen); if (setEl.hidden) openSettings(); else setEl.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true }); } });

// ── shortcuts: one list (keys.js) drives the handlers, the tooltips, the sheet and this page ──
function keysSheetRender() {
  const col = (ids) => `<dl class="keys">${ids.map((g) => `<dt class="kh">${esc(K.GROUPS.find((x) => x.id === g).name)}</dt><dd></dd>` +
    K.ACTIONS.filter((a) => a.scope === g).map((a) => `<dt><kbd>${K.keyHtml(K.label(a.id))}</kbd></dt><dd>${esc(a.label)}</dd>`).join("")).join("")}</dl>`;
  $("#keys-cols").innerHTML = col(["global", "picture"]) + col(["decision", "intel"]);
}
/** The Keyboard page, drawn in place: the key under the keyboard stays the same node as it records, cancels or changes. */
function keysPageRender() {
  const box = $("#set-keys-list");
  const rec = S.recording, err = S.keyErr;
  redraw(box, `<p class="kp-t">Click a key to change it. Keys that work anywhere need ⌘ or Ctrl, or a symbol like / or ?, so typing never sets them off. Your keys are kept in this browser.</p>` +
    K.GROUPS.map((g) => `<section class="kg" aria-labelledby="kg-${g.id}"><h3 id="kg-${g.id}">${esc(g.name)}</h3><div class="kl">` +
      K.ACTIONS.filter((a) => a.scope === g.id).map((a) => {
        const key = a.fixed
          ? `<span class="kr-k is-fixed" title="This one is fixed"><kbd>${K.keyHtml(a.fixed)}</kbd></span>`
          : `<button type="button" class="kr-k${rec === a.id ? " is-rec" : ""}" data-rebind="${a.id}" aria-label="${esc(a.label)}: ${esc(K.label(a.id))}. ${rec === a.id ? "Press the new key, or Esc to cancel" : "Change it"}">${rec === a.id ? `<span class="kr-rec">Press a key…</span>` : `<kbd>${K.keyHtml(K.label(a.id))}</kbd>`}</button>`;
        const reset = !a.fixed && K.changed(a.id) ? `<button type="button" class="kr-r" data-kreset="${a.id}" title="Back to ${esc(K.show(a.def))}" aria-label="Reset ${esc(a.label)} to ${esc(K.show(a.def))}">${ICON.retry}</button>` : `<span class="kr-r" aria-hidden="true"></span>`;
        return `<div class="kr${K.changed(a.id) ? " is-changed" : ""}${a.fixed ? " is-fixed" : ""}"><span class="kr-l">${esc(a.label)}</span>${key}${reset}</div>` +
          (err && err.id === a.id ? `<p class="kr-err" role="alert">${esc(err.msg)}</p>` : "");
      }).join("") + `</div></section>`).join("") +
    `<div class="kp-f"><button type="button" class="btn" id="keys-reset-all"${K.anyChanged() ? "" : " disabled"}>${ICON.retry}Reset all to defaults</button></div>`);
}
$("#set-keys-list").addEventListener("click", (e) => {
  const rb = e.target.closest("[data-rebind]");
  if (rb) { S.keyErr = null; S.recording = S.recording === rb.dataset.rebind ? null : rb.dataset.rebind; keysPageRender(); return; }
  // a reset takes its own button away (nothing left to reset): the keyboard goes to the key it reset,
  // and after Reset all, which disables itself, to the first key in the list
  const rs = e.target.closest("[data-kreset]");
  if (rs) { const id = rs.dataset.kreset; S.keyErr = null; K.reset(id); $(`[data-rebind="${id}"]`)?.focus({ preventScroll: true }); return; }
  if (e.target.closest("#keys-reset-all")) { S.keyErr = null; S.recording = null; K.resetAll(); $("#set-keys-list [data-rebind]")?.focus({ preventScroll: true }); }
});
document.addEventListener("pointerdown", (e) => {
  // a click anywhere but a key chip cancels a recording
  if (S.recording && !e.target.closest?.("[data-rebind]")) { S.recording = null; S.keyErr = null; keysPageRender(); }
}, true);
addEventListener("keydown", (e) => {
  if (!S.recording) return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) { S.recording = null; S.keyErr = null; keysPageRender(); return; }
  const combo = K.fromEvent(e);
  if (!combo) return; // a modifier on its own: keep listening
  const id = S.recording;
  const r = K.set(id, combo);
  S.recording = null;
  S.keyErr = r.error ? { id, msg: r.error } : null;
  keysPageRender();
  if (r.ok) announce(`${K.ACTIONS.find((a) => a.id === id).label}: ${K.label(id)}`);
}, true);
K.onChange(() => { keysPageRender(); if (!keys.hidden) keysSheetRender(); schedule(); });
keysPageRender();
// the rail's keys (WAI-ARIA tabs, chosen as they're reached): down/right the next, up/left the previous, wrapping; Home, End
setEl.querySelector(".set-nav").addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const tabs = $$("[data-set]");
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const j = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1
    : e.key === "ArrowDown" || e.key === "ArrowRight" ? (i + 1) % tabs.length
    : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : -1;
  if (j < 0) return;
  e.preventDefault();
  tabs[j].focus(); setPage(tabs[j].dataset.set);
});
// a column of tabs at the side; on a phone, a row across the top
{ const nav = setEl.querySelector(".set-nav"), orient = () => nav.setAttribute("aria-orientation", PHONE.matches ? "horizontal" : "vertical"); orient(); PHONE.addEventListener("change", orient); }

// ── theme toggle ────────────────────────────────────────────────────────────
$("#theme").addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  try { localStorage.setItem("cv-theme", t); } catch { /* private */ }
  applyTheme(t);
  lookSync();
  announce(t === "light" ? "Light mode" : "Dark mode");
});

// ── the sidebar: folds to its rail; More holds every further place ─────────────
// Folded, the sidebar is a rail of the same rows with their words hidden (64 = 12 + a 40 row + 12, tokens.css
// --side-rail-w); a row's name is its tooltip. Kept per browser. Not on a phone: there the sidebar is a drawer.
const SIDE = {
  KEY: "xo-side-folded", PINS: "xo-side-pins",
  folded: (() => { try { return localStorage.getItem("xo-side-folded") === "1"; } catch { return false; } })(),
  fold(on, { quiet = false } = {}) {
    SIDE.folded = !!on;
    try { localStorage.setItem(SIDE.KEY, on ? "1" : "0"); } catch { /* private */ }
    $("#app").classList.toggle("side-folded", SIDE.folded);
    const b = $("#side-fold");
    b.setAttribute("aria-expanded", String(!SIDE.folded));
    b.setAttribute("aria-label", SIDE.folded ? "Show the sidebar" : "Fold the sidebar");
    b.title = `${SIDE.folded ? "Show" : "Fold"} the sidebar${K.hint("sideFold")}`;
    $("#side-jump").title = `Search and jump${K.hint("jump")}`;
    // the places' names become their tooltips while the words are hidden
    for (const r of $$("#side .nav .nrow")) { const n = r.querySelector(".nr-name")?.textContent || ""; if (SIDE.folded) r.title = n; else r.removeAttribute("title"); }
    SIDE.closeMore();
    if (!quiet) { announce(SIDE.folded ? "Sidebar folded" : "Sidebar shown"); render(); }
  },
  // The bar (the owner, 19 Nov 14:29Z: "customize the bar: what to keep, what not to keep"): every place, in the
  // order you set; the ones you keep are rows, the rest wait in More. Kept in your shape (layout.side, js/shape.js),
  // so it follows you to every device; what this browser kept before is moved there once. Settings' own pages are
  // places too; new places arrive in More.
  BAR: "xo-side-bar",
  CORE: [
    { id: "home", name: "Home", sel: "#nv-home" },
    { id: "ws", name: "Workspace", sel: "#nv-ws" },
    { id: "chats", name: "Chats", sel: "#nv-chats" },
    { id: "arts", name: "Artifacts", sel: "#nv-arts" },
  ],
  PLACES: [
    { id: "launchpad", name: "Launchpad", sel: "#nv-lp" },
    { id: "runtimes", name: "Runtimes", ic: () => ICON.runtime },
    { set: true, id: "accounts", name: "Accounts", ic: () => ICON.person },
    { set: true, id: "routing", name: "Routing", ic: () => ICON.router },
    { set: true, id: "rules", name: "Rules", ic: () => ICON.rule },
    { set: true, id: "worktrees", name: "Worktrees", ic: () => ICON.branch },
    { set: true, id: "keys", name: "Keyboard", ic: () => ICON.key },
  ],
  all() { return [...SIDE.CORE, ...SIDE.PLACES]; },
  byId(id) { return SIDE.all().find((p) => p.id === id); },
  /** {order, shown}: what you saved, made whole (a place it doesn't know joins at the end, hidden; one it knows
   *  no more is dropped). Before this, More's pins said which of Settings' pages showed: they still do. */
  bar() {
    const ids = SIDE.all().map((p) => p.id), def = { order: ids, shown: SIDE.CORE.map((p) => p.id) };
    let v = SHAPE.get("layout")?.side ?? null;
    if (v == null) { try { v = JSON.parse(localStorage.getItem(SIDE.BAR) || "null"); } catch { v = null; } }
    if (!v || !Array.isArray(v.order) || !Array.isArray(v.shown)) {
      let pins = [];
      try { pins = JSON.parse(localStorage.getItem(SIDE.PINS) || "[]"); } catch { pins = []; }
      return { order: def.order, shown: [...def.shown, ...(Array.isArray(pins) ? pins.filter((x) => ids.includes(x)) : [])] };
    }
    const order = [...v.order.filter((x) => ids.includes(x)), ...ids.filter((x) => !v.order.includes(x))];
    return { order: [...new Set(order)], shown: v.shown.filter((x) => ids.includes(x)) };
  },
  save(b) { SHAPE.patchMine({ layout: { side: { order: b.order, shown: b.shown } } }); try { localStorage.removeItem(SIDE.BAR); localStorage.removeItem(SIDE.PINS); } catch { /* private */ } SIDE.apply(); },
  isDefault(b = SIDE.bar()) { const d = SIDE.all().map((p) => p.id); return b.order.join() === d.join() && b.shown.join() === SIDE.CORE.map((p) => p.id).join(); },
  reset() { SHAPE.patchMine({ layout: { side: null } }); try { localStorage.removeItem(SIDE.BAR); localStorage.removeItem(SIDE.PINS); } catch { /* private */ } SIDE.apply(); },
  /** What this browser kept before the bar lived in your shape (its own key, or More's pins): moved there once. */
  adopt() {
    if (SHAPE.get("layout")?.side != null) return;
    let had = false;
    try { had = localStorage.getItem(SIDE.BAR) != null || localStorage.getItem(SIDE.PINS) != null; } catch { had = false; }
    if (had && !SIDE.isDefault()) SIDE.save(SIDE.bar());
  },
  /** Keep a place in the bar, or send it to More (More's pin, the editor's switch). */
  pin(id, on) {
    const b = SIDE.bar();
    b.shown = b.shown.filter((x) => x !== id);
    if (on) b.shown.push(id);
    SIDE.save(b);
  },
  /** Move a place one step (dir −1 / +1), or to before another (the editor's drag). */
  move(id, dir, before = null) {
    const b = SIDE.bar(), o = b.order.filter((x) => x !== id);
    let at = before != null ? (before === "" ? o.length : o.indexOf(before)) : Math.max(0, Math.min(o.length, b.order.indexOf(id) + dir));
    if (at < 0) at = o.length;
    o.splice(at, 0, id);
    b.order = o;
    SIDE.save(b);
  },
  extras: new Map(), // a Settings page kept in the bar: its row, made once
  /** The sidebar's rows, as the bar says: the four places are the page's own rows (they keep their counts), moved
   *  and hidden; Settings' pages are rows made for them. All of them before More. */
  apply() {
    const b = SIDE.bar(), nav = $("#side .nav"), more = $("#nv-more");
    for (const p of SIDE.PLACES) if (!b.shown.includes(p.id)) SIDE.extras.get(p.id)?.remove();
    for (const id of b.order) {
      const p = SIDE.byId(id), on = b.shown.includes(id);
      let el = p.sel ? $(p.sel) : SIDE.extras.get(id);
      if (!p.sel && on && !el) {
        const t = document.createElement("template");
        t.innerHTML = `<button type="button" class="nrow" data-set-open="${p.id}"><span class="nr-ic">${p.ic()}</span><span class="nr-name">${esc(p.name)}</span></button>`;
        el = t.content.firstElementChild; SIDE.extras.set(id, el);
      }
      if (!el) continue;
      if (p.sel) el.hidden = !on;
      if (on || p.sel) { if (el.nextElementSibling !== more || el.parentNode !== nav) nav.insertBefore(el, more); }
      if (on && SIDE.folded) el.title = p.name;
    }
    if (!$("#side-more").hidden) SIDE.drawMore();
  },
  drawPins() { SIDE.apply(); },
  /** More: the places you didn't keep, each with its pin, and "Edit the sidebar…"; or, editing, every place with
   *  its switch and its grip (drag, or ↑ ↓ on the grip), Reset and Done. */
  drawMore() {
    const b = SIDE.bar(), pop = $("#side-more");
    const icon = (p) => (p.ic ? p.ic() : $(p.sel)?.querySelector(".nr-ic")?.innerHTML || "");
    let html;
    if (SIDE.editing) {
      pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Edit the sidebar");
      html = `<div class="se-h"><b>Edit the sidebar</b><span>Keep a place in the bar, or leave it in More. Drag to reorder, or ↑ ↓ on its grip.</span></div><ul class="se-list">` +
        b.order.map((id) => { const p = SIDE.byId(id), on = b.shown.includes(id);
          return `<li class="se-row${on ? "" : " is-off"}" data-se="${id}" draggable="true">` +
            `<button type="button" class="se-grip" data-se-grip="${id}" aria-label="Move ${esc(p.name)}: up or down arrow" title="Drag, or ↑ ↓">${xi("drag-handle")}</button>` +
            `<span class="nr-ic">${icon(p)}</span><span class="nr-name">${esc(p.name)}</span>` +
            `<button type="button" class="switch se-sw" role="switch" data-se-sw="${id}" aria-checked="${on}" aria-label="Keep ${esc(p.name)} in the sidebar"><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button></li>`; }).join("") +
        `</ul><div class="se-f"><button type="button" class="btn" data-se-reset${SIDE.isDefault(b) ? " disabled" : ""}>Reset to default</button><button type="button" class="btn btn-pri" data-se-done>Done</button></div>`;
    } else {
      pop.setAttribute("role", "menu"); pop.setAttribute("aria-label", "More places");
      const rest = b.order.filter((id) => !b.shown.includes(id)).map((id) => SIDE.byId(id)).filter((p) => !p.set); // Settings' pages stay in Settings and the editor
      html = rest.map((p) => {
        const go = p.sel ? `data-go="${$(p.sel).dataset.go}"` : `data-set-open="${p.id}"`;
        return `<div class="sm-row" role="none"><button type="button" class="nrow" role="menuitem" ${go}><span class="nr-ic">${icon(p)}</span><span class="nr-name">${esc(p.name)}</span></button>` +
          `<button type="button" class="sm-pin" data-side-pin="${p.id}" aria-pressed="false" title="Keep in the sidebar" aria-label="Keep ${esc(p.name)} in the sidebar">${ICON.pin}</button></div>`; }).join("") +
        `${rest.length ? `<div class="sm-sep" role="separator"></div>` : ""}<div class="sm-row" role="none"><button type="button" class="nrow" role="menuitem" data-side-edit><span class="nr-ic">${ICON.edit}</span><span class="nr-name">Edit the sidebar…</span></button></div>`;
    }
    if (pop._h !== html) { redraw(pop, html); pop._h = html; }
  },
  editing: false,
  edit(on) {
    SIDE.editing = !!on; SIDE.drawMore();
    const pop = $("#side-more");
    (on ? pop.querySelector("[data-se-grip]") : pop.querySelector('[role="menuitem"]'))?.focus({ preventScroll: true });
  },
  openMore(e) {
    const pop = $("#side-more"), row = $("#nv-more");
    SIDE.drawMore();
    pop.hidden = false;
    row.setAttribute("aria-expanded", "true"); row.classList.add("is-on");
    // it springs from its row: beside it, level with it
    const r = row.getBoundingClientRect();
    pop.style.setProperty("--pop-x", `${Math.round(r.right)}px`); pop.style.setProperty("--pop-y", `${Math.round(r.top)}px`);
    focusOpened(pop, e);
  },
  closeMore({ focus = false } = {}) {
    const pop = $("#side-more"), row = $("#nv-more");
    if (!pop || pop.hidden) return;
    pop.hidden = true; SIDE.editing = false;
    row.setAttribute("aria-expanded", "false"); row.classList.remove("is-on");
    if (focus) row.focus({ preventScroll: true });
  },
};
$("#side-fold").addEventListener("click", () => SIDE.fold(!SIDE.folded));
$("#side-jump").addEventListener("click", () => (jump.hidden ? openJump() : closeJump()));
$("#nv-more").addEventListener("click", (e) => ($("#side-more").hidden ? SIDE.openMore(e) : SIDE.closeMore({ focus: true })));
pointerFollows($("#side-more"));
$("#side-more").addEventListener("click", (e) => {
  const t = e.target, pop = $("#side-more");
  const pin = t.closest("[data-side-pin]");
  if (pin) { const id = pin.dataset.sidePin; SIDE.pin(id, true); announce(`${SIDE.byId(id).name} is in the sidebar`); focusOpened(pop, e); return; }
  if (t.closest("[data-side-edit]")) { SIDE.edit(true); return; }
  const sw = t.closest("[data-se-sw]");
  if (sw) { const id = sw.dataset.seSw, on = sw.getAttribute("aria-checked") !== "true"; SIDE.pin(id, on); announce(`${SIDE.byId(id).name}: ${on ? "in the sidebar" : "in More"}`); pop.querySelector(`[data-se-sw="${id}"]`)?.focus({ preventScroll: true }); return; }
  if (t.closest("[data-se-reset]")) { SIDE.reset(); announce("The sidebar is back to its default"); pop.querySelector("[data-se-done]")?.focus({ preventScroll: true }); return; }
  if (t.closest("[data-se-done]")) { SIDE.edit(false); return; }
  if (t.closest("[data-set-open],[data-go]")) SIDE.closeMore();
});
$("#side-more").addEventListener("keydown", (e) => {
  const grip = e.target.closest?.("[data-se-grip]");
  if (grip && (e.key === "ArrowUp" || e.key === "ArrowDown") && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    const id = grip.dataset.seGrip;
    SIDE.move(id, e.key === "ArrowUp" ? -1 : 1);
    const b = SIDE.bar();
    announce(`${SIDE.byId(id).name}: ${b.order.indexOf(id) + 1} of ${b.order.length}`);
    $(`#side-more [data-se-grip="${id}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (SIDE.editing) SIDE.edit(false); else SIDE.closeMore({ focus: true }); return; }
  if (SIDE.editing) return;
  const items = $$('#side-more [role="menuitem"]'), i = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const j = i < 0 ? (e.key === "ArrowDown" ? 0 : items.length - 1) : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[j]?.focus({ preventScroll: true }); }
});
// the editor's drag: a row dropped on another goes before it (after it, past its middle)
$("#side-more").addEventListener("dragstart", (e) => { const r = e.target.closest?.(".se-row"); if (!r) return; e.dataTransfer.setData("text/x-xo-place", r.dataset.se); e.dataTransfer.effectAllowed = "move"; r.classList.add("is-drag"); });
$("#side-more").addEventListener("dragend", (e) => { e.target.closest?.(".se-row")?.classList.remove("is-drag"); $$("#side-more .se-row.is-over").forEach((x) => x.classList.remove("is-over", "is-after")); });
$("#side-more").addEventListener("dragover", (e) => {
  const r = e.target.closest?.(".se-row"); if (!r) return;
  e.preventDefault(); e.dataTransfer.dropEffect = "move";
  const after = e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2;
  $$("#side-more .se-row.is-over").forEach((x) => x !== r && x.classList.remove("is-over", "is-after"));
  r.classList.add("is-over"); r.classList.toggle("is-after", after);
});
$("#side-more").addEventListener("drop", (e) => {
  const r = e.target.closest?.(".se-row"), id = e.dataTransfer.getData("text/x-xo-place");
  if (!r || !id || r.dataset.se === id) return;
  e.preventDefault();
  const after = e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2;
  const next = after ? r.nextElementSibling?.dataset.se ?? "" : r.dataset.se;
  if (next !== id) SIDE.move(id, 0, next);
});
document.addEventListener("pointerdown", (e) => { if (!$("#side-more").hidden && !e.target.closest("#side-more,#nv-more")) SIDE.closeMore(); });
SIDE.apply();
// your shape is read from Storm after load (and another device can change it): the bar follows; this browser's old
// copy moves into it once it's read
SHAPE.synced.then(() => { SIDE.adopt(); SIDE.apply(); });
SHAPE.onChange(() => SIDE.apply());

// the Map's toggle, in every conversation's header
document.addEventListener("click", (e) => { if (e.target.closest?.("[data-stage-toggle]")) STAGE.toggle(); else if (e.target.closest?.("[data-stage-open]")) STAGE.threads(); else { const b = e.target.closest?.("[data-lp-open]"); if (b) { if (LW.isOpen) LW.close(); else LW.open(S.view, b); } } });

// ── global keys ─────────────────────────────────────────────────────────────
const GLOBAL = {
  shells: () => SH.toggle(),
  jump: () => (jump.hidden ? openJump() : closeJump()),
  intel: () => { const K = composerNow(); toggleIq(sessionOf(K.view), K.iq); },
  write: () => composerNow().say.focus(),
  keys: () => openKeys(),
  map: () => STAGE.toggle(),
  sideFold: () => SIDE.fold(!SIDE.folded),
};
addEventListener("keydown", (e) => {
  if (S.recording) return; // Settings › Keyboard is listening for a new key
  // a key that's part of a word being composed (an IME: its Escape cancels the word, its arrows move in the
  // candidates) is the field's, never a page key (Conversation's finding: a composing Escape reached it)
  if (e.isComposing || e.keyCode === 229) return;
  // inside a shell every key is the shell's (Esc for vim, Ctrl+K for bash), but the shells' own toggle
  if (SH.owns(e)) { if (K.hasMod("shells") && K.is(e, "shells")) { e.preventDefault(); GLOBAL.shells(); } return; }
  // a key that works anywhere, by one rule (js/keys.js globalFor: the one Settings checks a key against): with ⌘/Ctrl
  // it works everywhere, even while typing (C118: only four actions' were answered here, so a ⌘/Ctrl key Settings
  // took for All shortcuts or Write did nothing)
  // A key the field you're typing in already took stays the field's: ⌘B in a Markdown page makes bold and doesn't
  // also fold the tree (the editor's keymap answers first, and says so with preventDefault)
  const g = K.globalFor(e), taken = e.defaultPrevented && K.typing(e);
  if (g && K.hasMod(g) && !taken && runGlobal(g)) { e.preventDefault(); return; }
  if (!jump.hidden) { if (e.key === "Escape") { e.preventDefault(); closeJump(); } return; }
  if (IQ.isOpen) { if (e.key === "Escape") { e.preventDefault(); IQ.close(); } return; }
  if (CREATE.isOpen()) return;
  if (e.key === "Escape") {
    // the layer on top goes first: a sheet, then Settings (it covers the main area), then what it covers
    if (QO.isOpen) { QO.close(); return; }
    if (RS.open) { runsEscape(); return; }
    if (!keys.hidden) { closeKeys(); return; }
    if (!allEl.hidden) { closeAll(); return; }
    if (!setEl.hidden) { closeSettings(); return; }
    // a file in the panel: back to its sections (the file stays as the Files tab)
    if (FP.isOpen) { STAGE.back(); return; }
    if ($("#app").classList.contains("drawer")) { setDrawer(false); return; }
    if (D.isOpen()) { D.close(); return; }
    if (CH.setupOpen) { CH.closeSetup(); return; }
    if (S.view.startsWith("t:")) back();
    else if (S.view.startsWith("c:")) go("chats");
    return;
  }
  if (K.typing(e) || e.metaKey || e.ctrlKey || e.altKey) return; // typing, even in Pierre's editor (a shadow root)
  if (!keys.hidden || !allEl.hidden) return;
  // Only keys that can't be hit by accident: no single letters (a stray keystroke must never
  // navigate or open something). Decision keys live on a focused decision card only.
  const s = K.globalFor(e, { typing: false });
  if (s && !K.hasMod(s) && runGlobal(s)) e.preventDefault();
});
/** Run a key that works anywhere; false when it has nothing to do here (the tree's fold away from Files: the key
 *  stays the browser's). */
function runGlobal(id) {
  // ⌘B: the panel's file browser folds to its rail (or opens), while Files shows
  if (id === "treeFold") return FP.toggleTree();
  // ⌘P, ⌘⇧F: only where the view has files (a project, a thread); elsewhere the browser keeps its keys
  if (id === "quickOpen") return QO.isOpen ? (QO.close(), true) : QO.open("files");
  if (id === "findInFiles") return QO.isOpen ? (QO.close(), true) : QO.open("text");
  if (!GLOBAL[id]) return false;
  GLOBAL[id]();
  return true;
}

// ── the phone's own Back (Android's back gesture, Safari's edge swipe) ──────
// The app keeps one history entry of its own while there is somewhere to go back to. Back then does
// what Esc does (the top sheet, the viewer, Settings, the sidebar), then a thread's parent, then the
// places you came through; with nothing left it lets the browser leave.
const sheetsOpen = () => QO.isOpen || !jump.hidden || !keys.hidden || !allEl.hidden || RS.open || CREATE.isOpen() || IQ.isOpen || CH.setupOpen;
const placeOk = (v) => v === "ws" || v === "chats" || !!PAGE_OF[v] || (v.startsWith("p:") && !!world.project(v.slice(2))) || (v.startsWith("t:") && !!world.thread(v.slice(2))) || v.startsWith("c:");
function canBack() {
  return sheetsOpen() || LB.isOpen || FP.isOpen || VW.isOpen || (STAGE.isOpen && PHONE.matches) || !setEl.hidden || D.isOpen() || $("#app").classList.contains("drawer") || SH.raised || S.view !== "home" || S.trail.length > 0;
}
/** One step back. False when there's nothing left in the app to go back to. */
function stepBack() {
  if (CREATE.isOpen()) { CREATE.close(); return true; }
  if (!jump.hidden) { closeJump(); return true; }
  if (IQ.isOpen) { IQ.close(); return true; }
  if (CH.setupOpen) { CH.closeSetup(); return true; }
  if (RS.open) { runsEscape(); return true; }
  if (!keys.hidden) { closeKeys(); return true; }
  if (!allEl.hidden) { closeAll(); return true; }
  if (LB.isOpen) { LB.close(); return true; }
  if (FP.isOpen) { STAGE.back(); return true; }
  if (VW.isOpen) { VW.close({ ask: true }); return true; }
  if (STAGE.isOpen && PHONE.matches) { STAGE.close(); return true; }
  if (!setEl.hidden) { closeSettings(); return true; }
  if (SH.raised && SH.lower()) return true;
  if ($("#app").classList.contains("drawer")) { setDrawer(false); return true; }
  if (D.isOpen()) { D.close(); return true; }
  if (S.view.startsWith("t:") || S.view.startsWith("c:")) { back(); return true; }
  while (S.trail.length) {
    const v = S.trail.pop();
    if (v === S.view || !placeOk(v)) continue;
    S.retrace = true; go(v); S.retrace = false;
    return true;
  }
  if (S.view !== "home") { S.retrace = true; go("home"); S.retrace = false; return true; }
  return false;
}
const HIST = { armed: history.state?.xo === 1 };
function armBack() {
  if (HIST.armed || !canBack()) return;
  try { history.pushState({ ...(history.state || {}), xo: 1 }, ""); HIST.armed = true; } catch { /* a sandboxed frame */ }
}
addEventListener("popstate", () => {
  HIST.armed = history.state?.xo === 1;
  if (HIST.armed) return; // forward onto our own entry: nothing to undo
  if (!stepBack()) { history.back(); return; }
  armBack();
});
// arm on the person's own taps and keys (an entry pushed without one can be skipped by Back)
document.addEventListener("click", () => setTimeout(armBack, 0), true);
addEventListener("keyup", () => setTimeout(armBack, 0), true);
document.addEventListener("touchend", () => setTimeout(armBack, 0), { capture: true, passive: true });
document.addEventListener("xo:gesture", armBack);

// ── touch: gestures for the same moves (js/gestures.js), and the title back to the top ──
wireGestures({
  phone: () => PHONE.matches,
  overlay: () => sheetsOpen() || FP.isOpen || (STAGE.isOpen && PHONE.matches) || !setEl.hidden || D.isOpen() || $("#app").classList.contains("drawer") || SH.raised,
  view: () => S.view,
  back,
  drawer: (open) => setDrawer(open),
  isDrawer: () => $("#app").classList.contains("drawer"),
  settingsOpen: () => !setEl.hidden, closeSettings: () => closeSettings(),
  viewerOpen: () => VW.isOpen, closeViewer: () => VW.close(),
  panelOpen: () => D.isOpen(),
  runsDeep: () => RS.open && RS.view === "run", runsBack: () => runsEscape(), runsCard,
  sheets: [
    { host: $("#panel"), open: () => PHONE.matches && D.isOpen(), close: () => D.close() },
    { host: allEl, card: () => allEl.querySelector(".sheet-card"), open: () => !allEl.hidden, close: closeAll },
    { host: jump, card: () => jump.querySelector(".sheet-card"), open: () => !jump.hidden, close: closeJump },
    { host: keys, card: () => keys.querySelector(".sheet-card"), open: () => !keys.hidden, close: closeKeys },
    { host: $("#iq-pop"), open: () => IQ.isOpen && $("#iq-pop").classList.contains("is-sheet"), close: () => IQ.close() },
    { host: $("#cs-pop"), open: () => CH.setupOpen && $("#cs-pop").classList.contains("is-sheet"), close: () => { CH.closeSetup(); updateComposer(); } },
  ],
  say,
  canResolve: () => !!world.act.storm,
  threadOf: (id) => world.thread(id),
  resolve: (tid, resolved, li) => resolveFromRow(tid, resolved, li),
  toast: (text) => toastLine(text),
});
/** fn, once the world shows what test() looks for: an act's answer reaches the world on its next commit. */
function whenWorld(test, fn) {
  let off = null, met = false;
  const check = () => { if (met || !test()) return; met = true; off?.(); fn(); };
  off = world.subscribe(check);
  if (met) off();
}
/**
 * Resolved (or reopened) by a swipe in All threads. The row says what is happening where it happened: waiting on
 * Space, then "Resolved" with Undo only once Space did it, or what refused it with Retry (the herald sits behind
 * the sheet). The row's button is one element through Undo, its wait and a refused Undo's Retry, so focus stays on
 * it; an Undo that works puts the thread's row back with focus on it. The list is drawn again a few seconds
 * later (the thread moves to where it now belongs), unless you're on the row.
 */
function resolveFromRow(tid, resolved, li) {
  const t = world.thread(tid);
  const name = t ? t.title : "";
  li.classList.remove("is-swiping", "is-armed");
  li.innerHTML = `<p class="ar-undo"><span></span><button type="button" data-ar-undo hidden></button></p>`;
  const box = li.firstElementChild, line = box.firstElementChild, btn = box.lastElementChild;
  let next = null;
  // the line says what's happening; the button (label undefined: as it is) stays one element throughout
  const show = (html, label, err = false) => {
    line.innerHTML = html;
    box.classList.toggle("is-err", err);
    if (label === undefined) return;
    btn.hidden = !label;
    if (label) btn.textContent = label;
  };
  const act = (to) => {
    const busy = (on) => { if (on) { box.setAttribute("aria-busy", "true"); btn.setAttribute("aria-busy", "true"); btn.setAttribute("aria-disabled", "true"); } else { box.removeAttribute("aria-busy"); btn.removeAttribute("aria-busy"); btn.removeAttribute("aria-disabled"); } };
    busy(true);
    show(`<i class="spin" aria-hidden="true"></i><b>${to ? "Resolving" : "Reopening"}</b> ${esc(name)}`);
    resolveThread(tid, to, { undo: false, sayFail: false }).then(({ ok, why }) => {
      busy(false);
      if (!li.isConnected) return;
      line.title = ok ? "" : why || "";
      if (ok && to === resolved) {
        show(`${ICON.check}<b>${resolved ? "Resolved" : "Reopened"}</b> ${esc(name)}`, "Undo");
        next = () => act(!resolved);
        clearTimeout(li._redraw);
        li._redraw = setTimeout(() => { if (li.isConnected && !li.contains(document.activeElement) && !allEl.hidden) allRender(); }, 5000);
      } else if (ok) {
        // undone: the thread's own row again, drawn once the world has it back as it was (Space's answer lands
        // in the world on its next commit), with focus on it if it was on Undo
        clearTimeout(li._redraw);
        whenWorld(() => (world.thread(tid)?.state === "resolved") === to, () => {
          if (!li.isConnected || allEl.hidden) return;
          const had = li.contains(document.activeElement);
          allRender();
          if (had) allEl.querySelector(`#all-list [data-go="t:${CSS.escape(tid)}"]`)?.focus({ preventScroll: true });
        });
      } else {
        show(`${ICON.close}<b>${to ? "Couldn't resolve" : "Couldn't reopen"}</b> ${esc(name)}`, "Retry", true);
        next = () => act(to);
      }
    });
  };
  btn.addEventListener("click", () => { if (btn.getAttribute("aria-busy") !== "true" && next) next(); });
  act(resolved);
}
// on a phone the shells open as a sheet over everything: the sidebar they were opened from steps aside
$("#nv-shells").addEventListener("click", () => setDrawer(false));
$("#pb-t").addEventListener("click", () => {
  (S.view === "home" ? $("#home") : scroller).scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
});

// ── boot ────────────────────────────────────────────────────────────────────
$("#brand-mark").innerHTML = XO;
$("#sc-ic").innerHTML = ICON.plus;
$("#ic-home").innerHTML = ICON.home;
$("#ic-ws").innerHTML = XO;
$("#ic-chats").innerHTML = ICON.thread;
$("#ic-arts").innerHTML = ICON.stack;
$("#ic-lp").innerHTML = ICON.deploy;
$("#ic-shells").innerHTML = ICON.shell;
// a new chat's setup: folder, agent, model, effort, what it may do (all from the runtime's feature list)
{
  const cs = $("#cs-pop");
  // drawn in place (CH.renderSetup): the picker or the mode you chose keeps focus; arrows move through the modes
  radioKeys(cs);
  cs.addEventListener("click", (e) => {
    const m = e.target.closest("[data-csmode]");
    if (m) { CH.setPref("mode", m.dataset.csmode); CH.closeSetup(); updateComposer(); return; }
    const ag = e.target.closest("[data-cs-agent]");
    if (ag) { if (ag.getAttribute("aria-checked") !== "true") { CH.setPref("agent", ag.dataset.csAgent); CH.renderSetup(); updateComposer(); } return; }
    const cwd = e.target.closest("[data-cs-cwd]");
    if (cwd) { CH.setPref("cwd", cwd.dataset.csCwd); CH.closeSetup(); updateComposer(); return; }
    for (const [k, sel, attr] of [["model", "[data-cs-model]", "csModel"], ["effort", "[data-cs-effort]", "csEffort"]]) {
      const r = e.target.closest(sel);
      if (r) { CH.setPref(k, r.dataset[attr]); CH.renderSetup(); updateComposer(); return; }
    }
    if (e.target.closest("[data-cs-done]")) { CH.closeSetup(); updateComposer(); }
  });
  cs.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); CH.closeSetup(); } });
  document.addEventListener("pointerdown", (e) => { if (CH.setupOpen && !cs.contains(e.target) && !e.target.closest("#target, #iq, #cs-perm")) CH.closeSetup(); });
}
$("#pb-menu").innerHTML = ICON.menu;
$("#top-menu").innerHTML = ICON.menu;
$("#side-x").innerHTML = ICON.close;
$("#pn-x").innerHTML = ICON.close;
$("#set-x").innerHTML = ICON.close;
$("#set-side-ic").innerHTML = ICON.gear;
// Settings' rail: each section with its icon (hub #18/#19)
{
  const IC = { general: ICON.sliders, appearance: ICON.contrast, shape: SHAPE_IC, routing: ICON.router, runtimes: ICON.runtime, accounts: ICON.person, rules: ICON.rule, worktrees: ICON.branch, night: ICON.moon, sounds: ICON.sound, keys: ICON.key };
  for (const b of $$("[data-set]")) b.innerHTML = `<span class="sn-ic" aria-hidden="true">${IC[b.dataset.set] || ""}</span><span class="sn-t">${esc(b.textContent)}</span>`;
}
$("#set-phone").innerHTML = ICON.gear;
$("#sound-tog .th-knob").innerHTML = ICON.sound;
for (const x of $$(".sheet [data-close]")) x.innerHTML = ICON.close;
$("#jump-ic").innerHTML = ICON.search;
$("#all-ic").innerHTML = ICON.search;
$("#send").innerHTML = ICON.send; $("#send").dataset.mode = "send";
applyTheme(THEME.get());
$("#side-fold").innerHTML = ICON.sidebar;
$("#side-jump").innerHTML = ICON.search;
$("#ic-more").innerHTML = xi("dashboard");
$("#nv-more .nr-chev").innerHTML = ICON.right;
SIDE.fold(SIDE.folded, { quiet: true });
soundRender();
PHONE.addEventListener("change", () => { setDrawer(false); render(); });

world.subscribe(() => schedule());
keepTurning(); // every arc on the page turns in step, however often it is redrawn
follow();
loadDraft();
render();
