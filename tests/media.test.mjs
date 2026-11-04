// Pictures and files in the conversation (js/media.js): the box a picture gets before its pixels, the
// album's justified rows, the dedupe of a turn's shared files against its messages, and the data that
// feeds them (attach.js attachmentsOf, timeline.js updateMessage). No network, no browser.
//   node tests/media.test.mjs
import assert from "node:assert/strict";

// js/ui.js reads the reduced-motion setting when it loads
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const M = await import("../js/media.js");
const { attachmentsOf } = await import("../js/attach.js");
const { uiMsg, updateMessage } = await import("../js/timeline.js");
const { turnHtml } = await import("../js/turnview.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const { them, you } = M.LIMITS;
const fit = (w, h, side = them) => M.fitImage(w, h, side.w, side.h);
/** Every row of an album is the album's width: its tiles plus the 2 px gaps between them. */
const rowsFill = (lay) => lay.rows.every((r) => r.tiles.reduce((a, x) => a + x.w, 0) + (r.tiles.length - 1) * M.GAP === lay.w);

// ── one picture ───────────────────────────────────────────────────────────
t("fitImage: scaled into the side's box, never upscaled", () => {
  assert.deepEqual(fit(2880, 1800), { w: 560, h: 350, mode: "fit" });     // a retina screenshot: the prose measure
  assert.deepEqual(fit(1170, 2532), { w: 222, h: 480, mode: "fit" });     // a phone screenshot (0.46) shows whole, 480 tall
  assert.deepEqual(fit(300, 200), { w: 300, h: 200, mode: "fit" });       // smaller than the box: its own size
  assert.deepEqual(fit(2880, 1800, you), { w: 320, h: 200, mode: "fit" }); // yours: 320 × 320 at most
  assert.deepEqual(fit(1170, 2532, you), { w: 148, h: 320, mode: "fit" });
});
t("fitImage: a long capture is cropped from its top; a short narrow one isn't", () => {
  assert.deepEqual(fit(1440, 6000), { w: 560, h: 480, mode: "long" });
  assert.deepEqual(fit(2880, 8518, you), { w: 320, h: 320, mode: "long" });
  assert.deepEqual(fit(100, 300), { w: 100, h: 300, mode: "fit" });       // under 1:2.5 but fits whole: nothing to crop
  assert.deepEqual(fit(300, 6000), { w: 300, h: 480, mode: "long" });      // narrower than the box: never widened
});
t("fitImage: tiny pictures sit at their own size in a 96 tile; banners keep 96 of height", () => {
  assert.deepEqual(fit(32, 32), { w: 96, h: 96, mode: "tiny", iw: 32, ih: 32 });
  assert.deepEqual(fit(95, 40), { w: 96, h: 96, mode: "tiny", iw: 95, ih: 40 });
  assert.equal(fit(96, 40).mode, "fit");                                   // one side at 96 is not tiny
  assert.deepEqual(fit(2000, 100), { w: 560, h: 96, mode: "banner" });
  assert.deepEqual(fit(400, 40), { w: 400, h: 96, mode: "banner" });
  assert.deepEqual(fit(1200, 200), { w: 560, h: 96, mode: "banner" });    // 6:1 would be 93 tall
  assert.deepEqual(fit(2200, 400), { w: 560, h: 102, mode: "fit" });      // 5.5:1 but tall enough already
  assert.deepEqual(fit(2400, 600), { w: 560, h: 140, mode: "fit" });      // 4:1 is not a banner
});
t("fitImage: an unknown size (null, missing, 0, junk) reserves a fixed 16:10 frame at the side's width", () => {
  for (const [w, h] of [[null, null], [undefined, undefined], [0, 0], ["abc", 10], [1440, null], [-5, 10]]) {
    assert.deepEqual(fit(w, h), { w: 560, h: 350, mode: "frame" }, `${w} × ${h}`);
    assert.deepEqual(fit(w, h, you), { w: 320, h: 200, mode: "frame" }, `${w} × ${h} (yours)`);
  }
  assert.deepEqual(fit("2880", "1800"), { w: 560, h: 350, mode: "fit" }); // numbers sent as strings still count
});

// ── albums ────────────────────────────────────────────────────────────────
t("albumLayout: the proposal's worked examples", () => {
  const two = M.albumLayout([4 / 3, 4 / 3], { W: them.w, maxH: them.h });
  assert.equal(two.w, 560); assert.equal(two.rows.length, 1); assert.equal(two.rows[0].h, 209); assert.equal(two.more, 0);
  const phones = M.albumLayout([390 / 844, 390 / 844], { W: you.w, maxH: you.h }); // clamped to 0.5
  assert.equal(phones.w, 320); assert.equal(phones.rows[0].h, 318);
  assert.deepEqual(phones.rows[0].tiles.map((x) => x.w), [159, 159]);
  const five = M.albumLayout(Array(5).fill(4 / 3), { W: them.w, maxH: them.h });
  assert.equal(five.w, 560); assert.equal(five.h, 420); assert.equal(five.rows.length, 2); assert.equal(five.more, 2);
  assert.ok([two, phones, five].every(rowsFill));
});
t("albumLayout: three with a landscape first: it leads a row of its own, capped at 0.6 × maxH; one rectangle", () => {
  const lay = M.albumLayout([1.6, 1.6, 1.6], { W: them.w, maxH: them.h });
  assert.deepEqual(lay.rows.map((r) => r.tiles.map((x) => x.i)), [[0], [1, 2]]);
  assert.ok(lay.rows[0].h <= 0.6 * them.h, `${lay.rows[0].h}`);
  assert.ok(lay.h <= them.h && lay.w <= them.w && rowsFill(lay));
  const portrait = M.albumLayout([0.75, 1.6, 1.6], { W: them.w, maxH: them.h });
  assert.equal(portrait.rows.length, 1); // not landscape first: one row of three
  assert.ok(rowsFill(portrait));
});
t("albumLayout: six → four tiles, the fourth +3; unknown and extreme shapes can't wreck a row", () => {
  const six = M.albumLayout(Array(6).fill(1.6), { W: them.w, maxH: them.h });
  assert.equal(six.rows.flatMap((r) => r.tiles).length, M.MAX_TILES);
  assert.equal(six.more, 3);
  const odd = M.albumLayout([NaN, null, 40, 0.01], { W: them.w, maxH: them.h }); // unknown → 16:10, extremes clamped to [0.5, 2]
  assert.ok(odd.h <= them.h && odd.w <= them.w && rowsFill(odd));
  assert.ok(odd.rows.every((r) => r.h > 100), JSON.stringify(odd.rows.map((r) => r.h)));
  // every height fits its side, for any count
  for (let n = 2; n <= 12; n++) for (const side of [them, you]) {
    const lay = M.albumLayout(Array.from({ length: n }, (_, i) => [0.46, 1.6, 1, 3, 0.3][i % 5]), { W: side.w, maxH: side.h });
    assert.ok(lay.w <= side.w && lay.h <= side.h + 1 && rowsFill(lay), `${n} on ${side.w}: ${lay.w} × ${lay.h}`);
  }
});

// ── dedupe and the data underneath ────────────────────────────────────────
t("dedupeByMade: a shared file a message carries (same made_id) isn't drawn twice; files without one stay", () => {
  const block = [{ name: "a.png", made_id: "m1" }, { name: "b.png", made_id: "m2" }, { name: "c.md" }];
  assert.deepEqual(M.dedupeByMade(block, [{ name: "a.png", made_id: "m1" }]).map((f) => f.name), ["b.png", "c.md"]);
  assert.deepEqual(M.dedupeByMade(block, new Set(["m2"])).map((f) => f.name), ["a.png", "c.md"]);
  assert.deepEqual([...M.madeIds([{ made_id: 7 }, {}, null])], ["7"]);
});
t("attachmentsOf: an agent's files are kept with their route; sizes only when the server sent them", () => {
  const row = { id: "cmsg_a", chat_id: "chat_p", author_kind: "agent", author_id: "thread", text: "Here it is.", created_at: "2026-11-04T10:00:00Z",
    extra: { attachments: [
      { name: "chart.png", type: "image/png", bytes: 41200, path: "out/chart.png", project_id: "billing", relative_path: ".xo/worktrees/t1/out/chart.png", made_id: "made_1", mtime: 1730714400, w: 2880, h: 1800, tint: "#f4f4f2" },
      { name: "logo.svg", type: "image/svg+xml", bytes: 900, path: "logo.svg", project_id: "billing", relative_path: "logo.svg", w: null, h: null, tint: null },
      { name: "notes.md", type: "text/markdown", bytes: 300, path: "notes.md", project_id: "billing", relative_path: "notes.md" },
      { name: "nowhere.png", type: "image/png" },
    ] } };
  const files = attachmentsOf(row);
  assert.equal(files.length, 3);
  assert.deepEqual(files[0], { name: "chart.png", type: "image/png", bytes: 41200, project_id: "billing", relative_path: ".xo/worktrees/t1/out/chart.png", path: "out/chart.png", made_id: "made_1", mtime: 1730714400, w: 2880, h: 1800, tint: "#f4f4f2" });
  assert.deepEqual([files[1].w, files[1].h, files[1].tint], [null, null, null]); // unreadable: null, kept
  assert.ok(!("w" in files[2]));                                                 // not a picture: no keys at all
  assert.equal(uiMsg(row).files.length, 3);                                      // no longer dropped on the agent's message
  // an older upload of yours: exactly what it was
  assert.deepEqual(attachmentsOf({ extra: { attachments: [{ id: "att_1", name: "shot.png", type: "image/png", bytes: 5 }] } }), [{ id: "att_1", name: "shot.png", type: "image/png", bytes: 5 }]);
});
t("updateMessage: files shared after the last reply land on it; reactions and the rest are kept", () => {
  const list = [{ id: "m1", extra: { reactions: [{ emoji: "👀" }] } }, { id: "m2" }];
  const next = updateMessage(list, { id: "m1", chat_id: "c", thread_ts: "t", extra: { attachments: [{ name: "a.png", project_id: "p", relative_path: "a.png" }] } });
  assert.notEqual(next, list);
  assert.deepEqual(next[0].extra.reactions, [{ emoji: "👀" }]);
  assert.equal(next[0].extra.attachments.length, 1);
  assert.equal(next[1], list[1]);
  assert.equal(updateMessage(list, { id: "nope", extra: {} }), null);
  assert.equal(updateMessage(list, { id: "m1" }), null);
  assert.equal(updateMessage(undefined, { id: "m1", extra: {} }), null);
});

// ── items and HTML ────────────────────────────────────────────────────────
t("items: an upload reads through its chat, an agent's file through its project; no route → a card that says why", () => {
  const up = M.fromAttachment({ id: "att_9", name: "me.png", type: "image/png", bytes: 10 }, { chat: "chat_p", by: "You" });
  assert.equal(up.kind, "image"); assert.equal(up.key, "att:chat_p:att_9"); assert.match(up.src, /chat\/chats\/chat_p\/attachments\/att_9$/);
  assert.equal(up.w, null); // an older upload: no size, so the frame
  const ag = M.fromAttachment({ name: "c.png", type: "image/png", project_id: "billing", relative_path: "out/c.png", w: 800, h: 600, tint: "#123456" });
  assert.deepEqual([ag.kind, ag.key, ag.project, ag.rel, ag.src, ag.w, ag.tint], ["image", "prj:billing:out/c.png", "billing", "out/c.png", null, 800, "#123456"]);
  // an older shared_files block: its path through the thread's route
  const route = (p) => (p.startsWith("/") ? { why: "Outside the thread's folder." } : { project: "billing", rel: `.xo/worktrees/t1/${p}` });
  const sh = M.fromSharedFile({ path: "shots/a.png", name: "a.png", type: "image/png" }, { route });
  assert.deepEqual([sh.kind, sh.project, sh.rel], ["image", "billing", ".xo/worktrees/t1/shots/a.png"]);
  const lost = M.fromSharedFile({ path: "/etc/a.png", name: "a.png", type: "image/png" }, { route });
  assert.deepEqual([lost.kind, lost.why], ["file", "Outside the thread's folder."]);
  assert.deepEqual(M.viewerFile(lost), { name: "a.png", type: "image/png", bytes: null, path: "/etc/a.png", why: "Outside the thread's folder." });
  assert.equal(M.fromSharedFile({ path: "x.png", name: "x.png", type: "image/png", project_id: "p", relative_path: "x.png" }).project, "p"); // newer: its own route wins
});
t("safeTint: hex and rgb() only (it goes into a style attribute)", () => {
  assert.equal(M.safeTint("#F4F4F2"), "#F4F4F2");
  assert.equal(M.safeTint("rgb(20, 20, 20)"), "rgb(20, 20, 20)");
  for (const bad of ["red;background:url(x)", "#12345", "url(x)", "", null, "#fff;}"]) assert.equal(M.safeTint(bad), null, String(bad));
});
t("mediaHtml: one picture's box is reserved from w × h, its tint the fill; an unknown size gets the 16:10 frame", () => {
  const one = M.mediaHtml([M.mediaItem({ key: "k1", name: "dash.png", type: "image/png", w: 2880, h: 1800, tint: "#141414", src: "a.png" })]);
  assert.match(one, /class="mx-one is-fit"/);
  assert.match(one, /--mx-w:560px;--mx-r:1\.6;--mx-tint:#141414/);
  assert.match(one, /aria-label="Open dash\.png, image, 2880 by 1800"/);
  const none = M.mediaHtml([M.mediaItem({ key: "k2", name: "old.png", type: "image/png", src: "b.png" })], { side: "you" });
  assert.match(none, /class="mx-one is-frame"/);
  assert.match(none, /--mx-w:320px;--mx-r:1\.6/);
  assert.match(none, /mx-stack mx-you/);
  const svg = M.mediaHtml([M.mediaItem({ key: "k3", name: "logo.svg", type: "image/svg+xml", w: null, h: null, tint: null, src: "c.svg" })]);
  assert.match(svg, /is-frame/);
  const long = M.mediaHtml([M.mediaItem({ key: "k4", name: "page.png", type: "image/png", w: 1440, h: 6000, src: "d.png" })]);
  assert.match(long, /is-long/); assert.match(long, /Long image · 1440 × 6000/);
  const evil = M.mediaHtml([M.mediaItem({ key: "k5", name: '"><script>', type: "image/png", w: 10, h: 10, tint: "red;x:y", src: "e.png" })]);
  assert.ok(!/<script>/.test(evil) && !/red;x:y/.test(evil));
});
t("mediaHtml: six pictures → an album of four tiles, the fourth +3, the lightbox's list holds all six; files stay cards", () => {
  const six = Array.from({ length: 6 }, (_, i) => M.mediaItem({ key: `p${i}`, name: `p${i}.png`, type: "image/png", w: 1440, h: 900, src: `p${i}.png` }));
  const md = M.mediaItem({ key: "f1", name: "notes.md", type: "text/markdown", bytes: 2048, project: "p", rel: "notes.md" });
  const html = M.mediaHtml([...six, md]);
  assert.equal((html.match(/class="mx-tile"/g) || []).length, 4);
  assert.match(html, /<span class="mx-more" aria-hidden="true">\+3<\/span>/);
  assert.match(html, /aria-label="Open p3\.png and 2 more pictures"/);
  const keys = JSON.parse(html.match(/data-mx-keys="([^"]+)"/)[1].replace(/&quot;/g, '"'));
  assert.deepEqual(keys, ["p0", "p1", "p2", "p3", "p4", "p5"]);
  assert.match(html, /class="tb-fb" data-mx="f1"/);
  assert.match(html, /<span class="tb-fm">Markdown · 2 KB<\/span>/);
  assert.match(html, /data-fi=/); // Pierre's coloured icon, not the plain doc glyph
  assert.equal(M.mediaItemOf("p4").name, "p4.png"); // registered for the lightbox and the click handler
  assert.equal(M.mediaHtml([]), "");
});

// ── a turn's shared files ─────────────────────────────────────────────────
t("turnHtml: a shared set with pictures is drawn as pictures, without the 'Shared N files' line; a carried one isn't drawn twice", () => {
  const turn = { id: "t1", status: "finished", at: "2026-11-04T10:00:00Z", end: { wall_ms: 4000 } };
  const files = [{ path: "a.png", name: "a.png", type: "image/png", made_id: "m1", project_id: "p", relative_path: "a.png", w: 800, h: 600 },
    { path: "b.png", name: "b.png", type: "image/png", made_id: "m2", project_id: "p", relative_path: "b.png", w: 800, h: 600 }];
  const block = { id: "f", type: "shared_files", done: true, header: "Shared 2 files", caption: "Before and after", files };
  const both = turnHtml(turn, [block]);
  assert.match(both, /mx-album/); assert.ok(!/Shared 2 files/.test(both)); assert.match(both, /<p class="mx-cap">Before and after<\/p>/);
  const one = turnHtml(turn, [block], { carried: [{ made_id: "m1", path: "a.png", name: "a.png" }] });
  assert.ok(!/data-mx="prj:p:a\.png"/.test(one)); assert.match(one, /class="mx-one is-fit" data-mx="prj:p:b\.png"/);
  assert.equal(turnHtml(turn, [block], { carried: files }), ""); // everything is on the message
  // files alone keep their line, with a true count
  const docs = { id: "g", type: "shared_files", done: true, header: "Shared 2 files", files: [{ path: "a.md", name: "a.md", type: "text/markdown", made_id: "x" }, { path: "b.md", name: "b.md", type: "text/markdown" }] };
  assert.match(turnHtml(turn, [docs], { route: () => ({ project: "p", rel: "b.md" }) }), /Shared 2 files/);
  assert.match(turnHtml(turn, [docs], { carried: [{ made_id: "x" }] }), /Shared 1 file</);
});
t("turnHtml: a file the turn only touched stays a chip, unless its message carries it", () => {
  const turn = { id: "t2", status: "finished", at: "2026-11-04T10:00:00Z", end: {} };
  const act = { id: "g0", type: "activity", done: true, rows: [{ call_id: "c0", kind: "create_file", status: "ok", line: "Created chart.png", target: "/w/out/chart.png" }, { call_id: "c1", kind: "edit_file", status: "ok", line: "Edited a.ts", target: "/w/a.ts" }] };
  const chips = (html) => (html.match(/class="tb-cfn">([^<]+)/g) || []).map((m) => m.split(">")[1]);
  assert.deepEqual(chips(turnHtml(turn, [act])), ["chart.png", "a.ts"]);
  assert.deepEqual(chips(turnHtml(turn, [act], { carried: [{ path: "out/chart.png", name: "chart.png" }] })), ["a.ts"]);
});

console.log(`\n${passed} passed`);
