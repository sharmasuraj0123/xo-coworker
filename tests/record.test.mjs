// A project's record (js/record.js): what threads made, and what happened since you last looked.
// Pure; no network.
//   node tests/record.test.mjs
import assert from "node:assert/strict";
import * as R from "../js/record.js";

// js/ui.js (through recordview.js) reads the reduced-motion setting when it loads
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { madeNaming } = await import("../js/recordview.js");
const S = await import("../js/skeleton.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const NOW = Date.parse("2026-11-03T13:00:00Z");
const H = 3600000;
const th = (id, state, hoursAgo, extra = {}) => ({ id, project: "p", title: id.toUpperCase(), state, lastAt: NOW - hoursAgo * H, checklist: { items: [] }, happened: "", outputs: [], ...extra });
const tree = (lost) => ({ exists: true, error: null, would_lose: lost });
const lost = ({ changed = 0, untracked = 0, commits = 0 } = {}) => ({ changed: { count: changed }, untracked: { count: untracked }, ignored: { count: 0 }, commits });

t("a made file's kind comes from its type, else its name", () => {
  assert.equal(R.madeKind({ type: "image/png", name: "a.png" }), "image");
  assert.equal(R.madeKind({ name: "shot.webp" }), "image");
  assert.equal(R.madeKind({ type: "text/html", name: "x" }), "page");
  assert.equal(R.madeKind({ name: "notes.md" }), "doc");
  assert.equal(R.madeKind({ name: "data.csv" }), "data");
  assert.equal(R.madeKind({ name: "panel.js" }), "code");
});

t("made items: newest thread first, a thread's last share first; pins flagged, keys stable", () => {
  const a = th("a", "done", 30, { outputs: [{ path: "one.md" }, { path: "two.png", type: "image/png", bytes: 9 }] });
  const b = th("b", "working", 1, { outputs: [{ path: "dir/three.html", name: "three.html" }] });
  const c = th("c", "done", 2); // shared nothing
  const items = R.madeItems([a, b, c], { pins: new Set([R.madeKey("a", "one.md")]) });
  assert.deepEqual(items.map((m) => m.name), ["three.html", "two.png", "one.md"]);
  assert.deepEqual(items.map((m) => m.kind), ["page", "image", "doc"]);
  assert.deepEqual(items.map((m) => m.pinned), [false, false, true]);
  assert.equal(items[1].bytes, 9);
  assert.equal(items[0].key, "b|dir/three.html");
});

t("made: filter by kind and words (the thread's title counts); groups drop empty ones", () => {
  const items = R.madeItems([th("a", "done", 200, { outputs: [{ path: "x.md" }, { path: "y.png" }] }), th("b", "done", 1, { outputs: [{ path: "z.md" }] })]);
  assert.deepEqual(R.filterMade(items, { kind: "doc" }).map((m) => m.name), ["z.md", "x.md"]);
  assert.deepEqual(R.filterMade(items, { q: "Y.P" }).map((m) => m.name), ["y.png"]);
  assert.deepEqual(R.filterMade(items, { q: "b" }).map((m) => m.name), ["z.md"]);
  const g = R.madeGroups(items.map((m, i) => (i === 2 ? { ...m, pinned: true } : m)), NOW);
  assert.deepEqual(g.map((x) => x.id), ["pinned", "today", "earlier"]);
});

t("git words from a worktree: uncommitted beats unpushed; ignored files and nothing lost are saved", () => {
  assert.deepEqual(R.gitState(tree(lost({ changed: 2, untracked: 1, commits: 3 }))), { group: "unsaved", word: "3 files not committed", n: 3 });
  assert.deepEqual(R.gitState(tree(lost({ commits: 1 }))), { group: "unpushed", word: "1 commit not pushed", n: 1 });
  assert.equal(R.gitState(tree(lost())).group, "saved");
  assert.equal(R.gitState(tree(null)).group, "saved");
  assert.equal(R.gitState({ exists: false }).group, "none");
  assert.equal(R.gitState(undefined).group, "none");
});

t("since you left: only what moved (or needs you), in the order you'd act on it", () => {
  const since = NOW - 48 * H;
  const threads = [
    th("old", "done", 72),                     // before you left: not mentioned
    th("ask", "needs_reply", 80),              // old, but it needs you
    th("dirty", "done", 5),
    th("ahead", "resolved", 6),
    th("clean", "done", 7),
    th("busy", "working", 1),                  // uncommitted work while working is normal: still going
    th("broke", "failed", 3),
  ];
  const trees = new Map([["dirty", tree(lost({ untracked: 1 }))], ["ahead", tree(lost({ commits: 2 }))], ["busy", tree(lost({ changed: 4 }))]]);
  const cu = R.catchUp(threads, { since, needing: new Set(["ask"]), trees });
  assert.deepEqual(cu.groups.map((g) => [g.id, g.items.map((x) => x.t.id)]), [
    ["needs", ["ask"]], ["unsaved", ["dirty"]], ["unpushed", ["ahead"]], ["stopped", ["broke"]], ["finished", ["clean"]], ["going", ["busy"]],
  ]);
  assert.equal(cu.total, 6);
  assert.equal(cu.groups.find((g) => g.id === "going").items[0].git.word, "4 files not committed");
  assert.equal(R.catchUp([th("old", "done", 72)], { since }).total, 0);
});

t("the headline: what happened, then whether anything needs you", () => {
  assert.deepEqual(R.headline({ finished: 3, unpushed: 1 }), { lead: "3 finished, 1 not pushed.", tail: "Nothing needs you." });
  assert.deepEqual(R.headline({ needs: 2, going: 1 }), { lead: "1 still going.", tail: "2 need you." });
  assert.deepEqual(R.headline({ needs: 1 }), { lead: "", tail: "1 needs you." });
});

t("what a thread did: its card's first sentence as plain words, else its last finished step", () => {
  assert.equal(R.didLine(th("a", "done", 1, { happened: "I researched **DeepSeek Harness (`dsh`)**, from [its repo](http://x). Then more." })), "I researched DeepSeek Harness (dsh), from its repo.");
  assert.equal(R.didLine(th("a", "done", 1, { checklist: { items: [{ state: "done", text: "Read the code" }, { state: "done", text: "Built the panel" }, { state: "todo", text: "Ship" }] } })), "Built the panel");
  assert.equal(R.didLine(th("a", "done", 1)), "");
});

t("how long you were away, and since when, in words", () => {
  assert.equal(R.awayWord(NOW - 9 * H, NOW), "9 hours");
  assert.equal(R.awayWord(NOW - 3 * 24 * H, NOW), "3 days");
  assert.equal(R.sinceWord(NOW - 24 * H, NOW), "yesterday");
  assert.match(R.sinceWord(NOW - 3 * 24 * H, NOW), /^[A-Z][a-z]+day$/);
});

t("seen: per place, kept in the store, survives a fresh read", () => {
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const a = R.createSeen(store);
  assert.equal(a.get("home"), null);
  a.mark("home", 5); a.mark("p:x", 7);
  const b = R.createSeen(store);
  assert.equal(b.get("home"), 5);
  assert.equal(b.get("p:x"), 7);
  const broken = R.createSeen({ getItem: () => "{nope", setItem() { throw new Error("full"); } });
  assert.equal(broken.get("home"), null);
  broken.mark("home", 1); // never throws
});


t("a newer backend's git state: merged says shipped (with its PR); pushed, unpushed and nothing to ship", () => {
  const g = (x) => ({ branch: "b", branch_exists: true, commits: 2, merged: false, upstream: null, unpushed: null, pr: null, ...x });
  assert.deepEqual(R.gitState(null, g({ merged: true, pr: { number: 37, url: "u", state: "MERGED" } })), { group: "shipped", word: "merged · PR #37", n: 0, url: "u" });
  assert.equal(R.gitState(null, g({ merged: true })).word, "merged");
  assert.deepEqual(R.gitState(null, g({ upstream: { pushed: true }, unpushed: 0, pr: { number: 9, state: "OPEN", url: "p" } })), { group: "unmerged", word: "PR #9 open", n: 0, url: "p" });
  assert.equal(R.gitState(null, g({ upstream: { pushed: true }, unpushed: 0 })).word, "pushed, no PR");
  assert.equal(R.gitState(null, g({ upstream: { pushed: true }, unpushed: 3 })).word, "3 commits not pushed");
  assert.equal(R.gitState(null, g({ upstream: null })).word, "2 commits not pushed");    // no upstream: all its own commits
  assert.equal(R.gitState(null, g({ commits: 0 })).group, "saved");
  // uncommitted files still come first, from the worktree; a removed tree keeps its last git state
  assert.equal(R.gitState(tree(lost({ changed: 1 })), g({ merged: true })).group, "unsaved");
  assert.equal(R.gitState({ exists: false, git: g({ merged: true }) }).group, "shipped");
  assert.equal(R.gitState({ ...tree(null), git: g({ merged: true }) }).group, "shipped");
});

t("since you left with git states: shipped and not merged get their own groups, and the headline says so", () => {
  const since = NOW - 48 * H;
  const threads = [th("a", "resolved", 3, { git: { merged: true, commits: 1 } }), th("b", "done", 2, { git: { commits: 1, upstream: { pushed: true }, unpushed: 0 } }), th("c", "done", 1, { summary: "Moved Shells into the foot." })];
  const cu = R.catchUp(threads, { since });
  assert.deepEqual(cu.groups.map((g) => g.id), ["unmerged", "shipped", "finished"]);
  assert.equal(cu.groups[2].items[0].line, "Moved Shells into the foot.");
  assert.deepEqual(R.headline(cu.counts), { lead: "1 shipped, 1 finished, 1 not merged.", tail: "Nothing needs you." });
});

t("made from the backend: its rows in the same shape, links and branches kept, missing fields tolerated", () => {
  const rows = [
    { id: "m1", kind: "file", name: "plan.md", mime: "text/markdown", bytes: 10, thread_ts: "a", updated_at: "2026-11-03T10:00:00Z", pinned: true, exists: true, project_id: "p", relative_path: ".xo/made/thread-a/plan.md", path: "plan.md" },
    { id: "m2", kind: "link", url: "https://github.com/x/y/pull/37", name: "PR #37", thread_ts: "b", created_at: "2026-11-03T12:00:00Z" },
    { id: "m3", kind: "branch", git: { branch: "xo/thread-1", merged: true }, thread_ts: "a", updated_at: "2026-11-03T11:00:00Z", exists: false },
    { kind: "file" },                                         // no id: dropped
  ];
  const items = R.madeFromServer(rows, { project: "p", threadTitle: (ts) => ({ a: "Alpha" })[ts] || "" });
  assert.deepEqual(items.map((m) => [m.key, m.kind]), [["m2", "link"], ["m3", "branch"], ["m1", "doc"]]);
  assert.equal(items[0].url, "https://github.com/x/y/pull/37");
  assert.equal(items[1].name, "thread-1");
  assert.equal(items[1].exists, false);
  assert.deepEqual([items[2].pinned, items[2].fileProject, items[2].rel, items[2].threadTitle, items[2].title], [true, "p", ".xo/made/thread-a/plan.md", "Alpha", null]);
  assert.deepEqual(R.madeFromServer(null), []);
  assert.deepEqual(R.filterMade(items, { kind: "link" }).map((m) => m.key), ["m2"]);
});

t("a made file's own title and its thread's title are kept apart (the server's rows and the threads' outputs)", () => {
  const rows = [
    { id: "m1", kind: "image", name: "r3-dark-panel-narrow-320.png", title: "Right panel,  dark, narrow", mime: "image/png", thread_ts: "a", updated_at: "2026-11-03T10:00:00Z", project_id: "p", relative_path: "out/r3-dark-panel-narrow-320.png", path: "out/r3-dark-panel-narrow-320.png" },
    { id: "m2", kind: "file", name: "notes.md", title: null, mime: "text/markdown", thread_ts: "a", updated_at: "2026-11-03T09:00:00Z" },
    { id: "m3", kind: "file", name: "old.md", thread_ts: "b", updated_at: "2026-11-03T08:00:00Z" }, // an older backend: no title key at all
  ];
  const items = R.madeFromServer(rows, { project: "p", threadTitle: (ts) => ({ a: "Design the picker", b: "Notes" })[ts] || "" });
  assert.deepEqual(items.map((m) => [m.title, m.threadTitle, m.name]), [
    ["Right panel, dark, narrow", "Design the picker", "r3-dark-panel-narrow-320.png"],
    [null, "Design the picker", "notes.md"],
    [null, "Notes", "old.md"],
  ]);
  // a search finds a file by its own title, its name, and the thread that made it
  assert.deepEqual(R.filterMade(items, { q: "dark, narrow" }).map((m) => m.key), ["m1"]);
  assert.deepEqual(R.filterMade(items, { q: "picker" }).map((m) => m.key), ["m1", "m2"]);
  assert.deepEqual(R.filterMade(items, { q: "old.md" }).map((m) => m.key), ["m3"]);
  // the older Made (a thread's outputs) carries a file's title the same way, and its thread's title apart
  const out = R.madeItems([th("t", "done", 1, { title: "Make the deck", outputs: [{ path: "deck/cover.png", title: "The cover" }, { path: "deck/notes.md" }] })]);
  assert.deepEqual(out.map((m) => [m.name, m.title, m.threadTitle]), [["notes.md", null, "Make the deck"], ["cover.png", "The cover", "Make the deck"]]);
});

t("a made card is named by the file's title, its thread link by the thread's: never the one for the other", () => {
  const titled = madeNaming({ kind: "image", name: "r3-dark-panel-narrow-320-title.png", title: "Right panel, dark, narrow", path: "out/r3-dark-panel-narrow-320-title.png", threadTitle: "Design the picker" });
  assert.equal(titled.label, "Right panel, dark, narrow");
  assert.equal(titled.html, "Right panel, dark, narrow");
  assert.equal(titled.from, "Design the picker");                       // the "from" link: the thread, not the file
  assert.equal(titled.file, "r3-dark-panel-narr…title.png");             // the second line: the file name, cut in its middle
  assert.equal(titled.tip, "Right panel, dark, narrow · out/r3-dark-panel-narrow-320-title.png"); // nothing lost
  const bare = madeNaming({ kind: "doc", name: "a-rather-long-report-name-final.md", title: null, path: "a-rather-long-report-name-final.md", threadTitle: "" });
  assert.equal(bare.label, "a-rather-long-report-name-final.md");
  assert.match(bare.html, /<span class="mx-mid"><span class="mx-mh">a-rather-long-report-name-<\/span><span class="mx-mt">final\.md<\/span><\/span>/);
  assert.equal(bare.from, "Its thread");                                 // no thread title: never the file's name or title
  assert.equal(bare.tip, "a-rather-long-report-name-final.md");
  // a link's words and a branch are cut at their end, not in the middle
  assert.equal(madeNaming({ kind: "link", name: "The pull request that moved Shells", path: "https://x/y", threadTitle: "T" }).html, "The pull request that moved Shells");
  assert.equal(madeNaming({ kind: "image", name: "a<b>.png", title: "<script>", path: "p", threadTitle: "t" }).html, "&lt;script&gt;");
});

// ── Artifacts at any size (record.js artsView, galleryLines, linesIn) and Made read a page at a time ─────
const many = (n, at0 = NOW) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, project: i % 3 ? "p" : "q", kind: ["doc", "image", "page", "code"][i % 4], name: `file-${i}.md`, path: `out/file-${i}.md`, title: null, threadTitle: i === n - 1 ? "The very last thread" : "", at: at0 - i * 3600000, pinned: i < 2 }));

t("Artifacts filters the whole set, never only what's drawn: the last of 5,000 is found by its words", () => {
  const all = many(5000);
  const v = R.artsView(all, { q: "file-4999.", now: NOW });
  assert.equal(v.total, 1);
  assert.deepEqual(v.groups.flatMap((g) => g.items.map((m) => m.key)), ["k4999"]);
  assert.equal(R.artsView(all, { q: "very last thread", now: NOW }).total, 1);   // the thread's title is searched too
  // the kinds count the project's whole set, and the kind filter keeps every one of them
  const inQ = R.artsView(all, { pid: "q", now: NOW });
  assert.equal(inQ.counts.all, all.filter((m) => m.project === "q").length);
  assert.equal(inQ.counts.image, all.filter((m) => m.project === "q" && m.kind === "image").length);
  const imgs = R.artsView(all, { pid: "q", kind: "image", now: NOW });
  assert.equal(imgs.total, inQ.counts.image);
  assert.equal(imgs.groups.reduce((s, g) => s + g.items.length, 0), imgs.total);
  assert.deepEqual(imgs.groups.map((g) => g.id), ["pinned", "today", "week", "earlier"].filter((id) => imgs.groups.some((g) => g.id === id)));
});

t("the gallery's lines: a heading, then rows of cards, each at its place; the last row of a group may be short", () => {
  const groups = [{ id: "pinned", label: "Pinned", items: [1, 2, 3, 4, 5] }, { id: "today", label: "Today", items: [1, 2, 3, 4] }];
  const { lines, height } = R.galleryLines(groups, { cols: 4, cardH: 254, headH: 52, gap: 16 });
  assert.deepEqual(lines.map((l) => [l.key, l.y, l.h, l.start, l.n]), [
    ["h:pinned", 0, 52, undefined, undefined], ["r:pinned:0", 52, 254, 0, 4], ["r:pinned:1", 322, 254, 4, 1],
    ["h:today", 576, 52, undefined, undefined], ["r:today:0", 628, 254, 0, 4],
  ]);
  assert.equal(height, 882);
  // the same set, two columns (a phone): twice the rows, the same order
  const two = R.galleryLines(groups, { cols: 2, cardH: 214, headH: 52, gap: 12 });
  assert.deepEqual(two.lines.filter((l) => l.kind === "row").map((l) => l.n), [2, 2, 1, 2, 2]);
  // more still being read: stand-in rows after the last, a gap below it
  const tail = R.galleryLines(groups, { cols: 4, cardH: 254, headH: 52, gap: 16, tail: 2 });
  assert.deepEqual(tail.lines.at(-1), { key: "sk", kind: "tail", y: 898, h: 524, rows: 2 });
  assert.equal(tail.height, 1422);
  assert.deepEqual(R.galleryLines([], { cols: 4, cardH: 10, headH: 5 }), { lines: [], height: 0 });
});

t("only the lines near the screen are drawn: 5,000 things, a few rows, wherever the scroll is", () => {
  const all = many(5000);
  const v = R.artsView(all, { now: NOW });
  const { lines, height } = R.galleryLines(v.groups, { cols: 4, cardH: 254, headH: 52, gap: 16 });
  assert.equal(lines.filter((l) => l.kind === "row").reduce((s, l) => s + l.n, 0), 5000);
  for (const top of [0, 1234, height / 2, height - 900]) {
    const got = R.linesIn(lines, top - 900, top + 1800);
    const want = lines.filter((l) => l.y + l.h >= top - 900 && l.y <= top + 1800);
    assert.deepEqual(got.map((l) => l.key), want.map((l) => l.key));
    assert.ok(got.length <= 14, `${got.length} lines drawn at ${top}`); // three screens, never the whole list
  }
  assert.deepEqual(R.linesIn(lines, height + 10, height + 900), []);
});

t("Made read a page at a time: older pages are kept, repeats dropped, the newest page wins", () => {
  const row = (id, at, extra = {}) => ({ id, updated_at: at, ...extra });
  const first = [row("a", "2026-11-04T10:00:05Z"), row("b", "2026-11-04T10:00:04Z")];
  // an older page, read from a second after the last row (the Space's cursor is strict): "b" comes again
  const older = [row("b", "2026-11-04T10:00:04Z"), row("c", "2026-11-04T10:00:04Z"), row("d", "2026-11-03T09:00:00Z")];
  let rows = R.mergeMadeRows(first, older);
  assert.deepEqual(rows.map((r) => r.id), ["a", "b", "c", "d"]);
  // the newest page again: a new one on top, "a" touched (pinned). Rows of the page's last second that it
  // doesn't hold may just not have fitted: they stay
  rows = R.mergeMadeRows(rows, [row("n", "2026-11-04T11:00:00Z"), row("a", "2026-11-04T10:30:00Z", { pinned: true }), row("b2", "2026-11-04T10:00:04Z")], { first: true });
  assert.deepEqual(rows.map((r) => r.id), ["n", "a", "b2", "b", "c", "d"]);
  // a newest page reaching further back: what it should hold but doesn't (moved, gone) goes
  rows = R.mergeMadeRows(rows, [row("n", "2026-11-04T11:00:00Z"), row("a", "2026-11-04T10:30:00Z", { pinned: true }), row("d", "2026-11-03T09:00:00Z")], { first: true });
  assert.deepEqual(rows.map((r) => r.id), ["n", "a", "d"]);
  assert.equal(rows[1].pinned, true);
  // a newest page that is everything there is: nothing else stays
  assert.deepEqual(R.mergeMadeRows(rows, [row("n", "2026-11-04T11:00:00Z")], { first: true, complete: true }).map((r) => r.id), ["n"]);
  assert.equal(R.olderCursor("2026-11-04T10:00:04Z"), "2026-11-04T10:00:05Z");
  assert.equal(R.olderCursor(null), null);
  assert.equal(R.olderCursor("not a time"), null);
});

t("loading in its final shape: the greeting is local, a stand-in card is built from the card's own classes", () => {
  assert.equal(S.greeting(3), "Working late");
  assert.equal(S.greeting(9), "Good morning");
  assert.equal(S.greeting(14), "Good afternoon");
  assert.equal(S.greeting(20), "Good evening");
  const page = S.skTile("page", 2), strip = S.skTile(true, 0);
  for (const cls of ["md-it is-sk", "md-open", "md-th", "md-meta", "md-from"]) assert.ok(page.includes(`class="${cls}"`), cls);
  assert.ok(!strip.includes("md-from"));                    // Home's strip has no "from" line, so neither does its stand-in
  assert.match(page, /aria-hidden="true"/);                 // a stand-in is never read out
});

console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
