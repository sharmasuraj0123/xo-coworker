import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createChats } from "../chats.js";

await dom('<div id="msgs"></div>');
const queued = { name: "antigravity", features: { features: { send_while_running: { behaviour: "queued" } } } };
const steered = { name: "claude_code", features: { features: { send_while_running: { behaviour: "steered" } } } };
const sessions = {
  s1: { id: "s1", role: "plain", agent: "antigravity", state: "waiting_on_person", native_id: "n1" },
  s2: { id: "s2", role: "plain", agent: "claude_code", state: "waiting_on_person", native_id: "n2" },
};
const hosts = [];
const chats = createChats({
  world: {
    state: { sessions, projects: [], runtimes: [queued, steered], hosts },
    project: () => null,
    onEvent() {},
    act: { sentAt: () => ({ at: 1, seq: 2 }), noteSession() {}, turnOf: () => "t1", sessionState: () => "waiting_on_person" },
  },
  view: () => "c:s1", go() {}, announce() {}, heraldShow() {}, restore: () => false, schedule() {},
}, {
  cliName: (name) => name || "", turnHtml: () => "", turnAv: () => "", chatOrder: () => [],
  heldShort: () => "", heldBadge: () => "", dayGroup: () => "", rowTime: () => "",
});
const words = (v) => chats.targetHtml(v).replace(/<[^>]+>/g, "");

assert.equal(words("c:s1"), "It waits for you · a reply here waits for its turn", "no card yet: it still says it waits on you");
hosts.push({ id: "session:s1", asks: [{ kind: "question", item: { id: "r1", kind: "question" } }] });
assert.equal(words("c:s1"), "Answer its question above · a reply here waits for its turn");
hosts.push({ id: "session:s2", asks: [{ kind: "permission", item: { id: "r2", kind: "permission" } }] });
assert.equal(words("c:s2"), "Decide above", "a runtime that steers adds no queue note");
assert.doesNotMatch(chats.targetHtml("c:s1"), /turn in progress/);
console.log("ok waiting-on-you");
