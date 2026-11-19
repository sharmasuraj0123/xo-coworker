// storm writes, end to end on a fake backend: optimistic with an honest rollback, and a refused decision never reported as made.
import { fakeBackend, boot, settle, fail, thread, runner } from "./storm-harness.mjs";

const { t, done, assert } = runner();
const item = (id, extra = {}) => ({ id, kind: "approval", state: "open", chat_id: "chat_p", thread_ts: "t1", title: "May I?", ...extra });

t("resolve shows at once and rolls back when Space refuses; reopen is the same call the other way", async () => {
  let refuse = true, answer;
  const gate = new Promise((r) => { answer = r; });
  const be = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("t1", { state: "needs_reply" })] },
    "PATCH /chat/chats/chat_p/threads/t1": async (_q, b) => (refuse ? (await gate, fail(409, { code: "busy", message: "no" })) : { ts: "t1", chat_id: "chat_p", state: b.resolved ? "resolved" : "working", resolved_at: b.resolved ? "2026-11-19T12:00:00Z" : null }),
  });
  const { world } = await boot(be);
  const refused = assert.rejects(world.act.resolve("t1", true), (e) => e.code === "busy");
  await settle();
  assert.equal(world.thread("t1").state, "resolved", "at once");
  answer();
  await refused;
  await settle();
  assert.equal(world.thread("t1").state, "needs_reply", "rolled back");
  refuse = false;
  await world.act.resolve("t1", true);
  await settle();
  assert.equal(world.thread("t1").resolvedAt, "2026-11-19T12:00:00Z", "Space's answer is kept");
  await world.act.resolve("t1", false);
  await settle();
  assert.equal(world.thread("t1").state, "working");
  assert.deepEqual(be.writes().map((w) => w.body), [{ resolved: true }, { resolved: true }, { resolved: false }]);
});

t("delete leaves the lists only once Space agrees; a refusal is thrown for the caller; restore brings the row back", async () => {
  let refuse = true;
  const be = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("t1")] },
    "DELETE /chat/chats/chat_p/threads/t1": () => (refuse ? fail(409, { code: "would_lose_work", message: "unpushed", confirm: "tok" }) : { deleted: true, undo_until: "soon" }),
    "POST /chat/chats/chat_p/threads/t1/restore": { ts: "t1", chat_id: "chat_p", title: "back" },
  });
  const { world } = await boot(be);
  await assert.rejects(world.act.deleteThread("t1"), (e) => e.code === "would_lose_work" && e.confirm === "tok");
  await settle();
  assert.ok(world.thread("t1"), "still listed");
  refuse = false;
  const res = await world.act.deleteThread("t1", { keepBranch: false, confirm: "tok" });
  await settle();
  assert.equal(world.thread("t1"), undefined);
  assert.deepEqual(be.writes().pop().body, { keep_branch: false, confirm: "tok" });
  assert.equal(res.row.ts, "t1");
  await world.act.restoreThread("t1", res.row);
  await settle();
  assert.equal(world.thread("t1").title, "back");
});

t("a decision made: the item leaves; the idempotency key is a client id unless the caller gives one", async () => {
  const be = fakeBackend({
    "GET /chat/review": { items: [item("i1"), item("i2")] },
    "POST /chat/review/i1/decision": { id: "i1", state: "decided" },
    "POST /chat/review/i2/decision": { id: "i2", state: "decided" },
  });
  const { world } = await boot(be);
  await world.act.decideItem("i1", { decision: "approve" });
  await world.act.decideItem("i2", { decision: "approve", idempotency_key: "mine" });
  const [a, b] = be.writes();
  assert.match(a.body.idempotency_key, /^ui_/);
  assert.equal(b.body.idempotency_key, "mine");
  assert.equal(world.state.review.size, 0);
});

t("a refused decision is never reported as made: the item is read again and the caller told why", async () => {
  const now = { i_gone: { id: "i_gone", state: "decided", decision: "deny" }, i_open: item("i_open", { title: "Fresh copy" }) };
  const be = fakeBackend({
    "GET /chat/review": { items: [item("i_gone"), item("i_open"), item("i_lost")] },
    "POST /chat/review/i_gone/decision": fail(409, { code: "already_decided", message: "decided elsewhere" }),
    "POST /chat/review/i_open/decision": fail(422, { code: "invalid", message: "answer again" }),
    "POST /chat/review/i_lost/decision": fail(404, { code: "review_not_found", message: "gone" }),
    "GET /chat/review/i_gone": now.i_gone,
    "GET /chat/review/i_open": now.i_open,
  });
  const { world } = await boot(be);
  await assert.rejects(world.act.decideItem("i_gone", { decision: "approve" }), (e) => e.gone === "already_decided" && e.item.decision === "deny");
  assert.equal(world.state.review.has("i_gone"), false);
  await assert.rejects(world.act.decideItem("i_open", { decision: "approve" }), (e) => e.gone === undefined && e.item.title === "Fresh copy");
  assert.equal(world.state.review.get("i_open").title, "Fresh copy", "a fresh copy to answer again");
  await assert.rejects(world.act.decideItem("i_lost", { decision: "approve" }), (e) => e.gone === "review_not_found" && e.item === null);
  assert.equal(world.state.review.has("i_lost"), false);
});

t("a decision that never reached XO leaves the item as it was, unread", async () => {
  const be = fakeBackend({ "GET /chat/review": { items: [item("i1")] } });
  const { world } = await boot(be);
  const fetch = globalThis.fetch;
  globalThis.fetch = /** @type {any} */ (async (url, opts) => ((opts && opts.method) === "POST" ? Promise.reject(new TypeError("offline")) : fetch(url, opts)));
  await assert.rejects(world.act.decideItem("i1", { decision: "approve" }), (e) => e.code === "network" && e.item === undefined);
  globalThis.fetch = fetch;
  assert.equal(be.count("GET", "/chat/review/i1"), 0);
  assert.equal(world.state.review.get("i1").state, "open");
});

t("rename answers with Space's row; the act.decide stub always refuses", async () => {
  const be = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("t1")] },
    "PATCH /chat/chats/chat_p/threads/t1": (_q, b) => ({ ts: "t1", chat_id: "chat_p", title: b.title }),
  });
  const { world } = await boot(be);
  await world.act.editThread("t1", { title: "Settings &amp; Home" });
  await settle();
  assert.equal(world.thread("t1").title, "Settings & Home", "a title that came escaped reads as meant");
  await assert.rejects(world.act.decide(), /decideItem/);
});

await done();
