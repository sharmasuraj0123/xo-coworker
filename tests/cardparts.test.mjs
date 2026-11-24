import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KINDS, kindOf, commandOf, headOf, whyOf, stripOf, chipsOf, optionsOf, pickKeys, actsOf, isOnePress, cap, goneLine } from "../js/cardparts.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const thread = { id: "t1", title: "Fix the build", project: "web", checklist: { items: [{ text: "Run the tests", state: "done" }, { text: "Push the branch", state: "todo" }], done: 1, total: 2 } };
const allowOpts = [{ id: "o1", decision: "allow", label: "Allow once" }, { id: "o2", decision: "deny", label: "Deny", note: true }];
const item = (over = {}) => ({ id: "rv_1", kind: "permission", title: "Run a command", why: "", risk: "notable", risk_reasons: [], detail: {}, options: allowOpts, ...over });
const node = (it, over = {}) => ({ key: "k", t: thread, risk: it.risk || "notable", group: it.risk || "notable", effort: "decide", ask: { id: it.id, kind: it.kind, title: it.title, item: it, live: true, storm: true }, ...over });

t("the headline is words: a long command in the title becomes 'a command', closed or clipped open", () => {
  const closed = node(item({ title: "Run `grep -rn proxy services/ | head -40`", detail: { command: "grep -rn proxy services/ | head -40" } }));
  assert.deepEqual(headOf(closed), { verb: "", text: "Run a command", md: true });
  const open = node(item({ title: "A sub-agent ('Check') wants to run `cd /home/coder/xo-space && grep -rn \"risk_reasons\" --include=*.py servi…", detail: { command: "cd /home/coder/xo-space && grep -rn \"risk_reasons\" --include=*.py services | head" } }));
  assert.equal(headOf(open).text, "A sub-agent ('Check') wants to run a command");
  assert.ok(!headOf(open).text.includes("`"));
  assert.equal(headOf(node(item({ title: "Run `npm test`", detail: { command: "npm test" } }))).text, "Run a command", "any command with a space is the strip's");
  assert.equal(headOf(node(item({ title: "Install it with `pnpm`", detail: { command: "pnpm install" } }))).text, "Install it with `pnpm`", "a lone word in code reads as a word");
  const bare = node(item({ title: "rm -rf build/cache", detail: { command: "rm -rf build/cache" } }));
  assert.deepEqual(headOf(bare), { verb: "Run", text: "a command", md: false }, "a title that is the command itself");
  const words = node(item({ title: "List the files changed on this branch", detail: { command: "git diff --stat main...HEAD" } }));
  assert.equal(headOf(words).text, "List the files changed on this branch", "Space's words stay as they are");
});
t("a file the agent reads or changes: the headline names the file, the strip holds its whole path", () => {
  const P = "/home/coder/.quirq/deploy-backups/2026-11-21-14c2ede/run-live-20261121-211553/status.json";
  const read = node(item({ risk: "destructive", title: `A sub-agent ('Verify') wants to read \`${P}\``, detail: { tool: "Read", kind: "read", command: null, paths: [P] } }));
  assert.equal(kindOf(read), "file");
  assert.deepEqual(headOf(read), { verb: "", text: "A sub-agent ('Verify') wants to read `status.json`", md: true });
  assert.deepEqual(stripOf(read), { type: "files", items: [P], more: 0 });
  assert.equal(commandOf(read.ask), "", "a path is never a command");
  const clipped = node(item({ title: `Read \`${P.slice(0, 40)}…`, detail: { kind: "read", paths: [P] } }));
  assert.equal(headOf(clipped).text, "Read `status.json`", "a title clipped inside the path still names the file");
  const many = node(item({ title: "Search the logs", detail: { kind: "search", paths: ["/a", "/b", "/c", "/d", "/e", "/f"] } }));
  assert.deepEqual(stripOf(many), { type: "files", items: ["/a", "/b", "/c", "/d"], more: 2 });
  assert.equal(kindOf(node(item({ title: "Do it", detail: { kind: "read", paths: [] } }))), "approval", "no path, nothing to show");
});
t("the headline of an old Run: ask, a stopped thread and a destructive legacy ask", () => {
  assert.deepEqual(headOf({ t: thread, risk: "notable", ask: { kind: "permission", title: "Run: npm test -- --watch" } }), { verb: "Run", text: "a command", md: false });
  assert.deepEqual(headOf({ t: thread, risk: "stopped", group: "stopped", ask: { kind: "stopped", title: "Fix the build" } }), { verb: "Stopped at", text: "Push the branch", md: false });
  assert.equal(headOf({ t: thread, risk: "destructive", ask: { kind: "approval", title: "Delete the cache: 4 GB in build/" } }).text, "Delete the cache");
});
t("the command: detail.command first, then the title's code (closed or clipped), then a Run: title", () => {
  assert.equal(commandOf({ title: "Run `ls -la /tmp/x`", item: { detail: { command: "ls -la /tmp/x --color" } } }), "ls -la /tmp/x --color");
  assert.equal(commandOf({ title: "Run `ls -la /tmp/x`" }), "ls -la /tmp/x");
  assert.equal(commandOf({ title: "Run `cd /srv && make deplo" }), "cd /srv && make deplo");
  assert.equal(commandOf({ title: "Run: npm test" }), "npm test");
  assert.equal(commandOf({ title: "Use `pnpm`" }), "", "a short word in code isn't a command");
  assert.equal(commandOf({ title: "Answer the question" }), "");
  assert.equal(commandOf({ title: "Run `ls -la /tmp/x`", item: { detail: {} } }), "", "an item's command is its detail's, never its title's");
});
t("the why line is the agent's own reason, capitalised; a stopped thread says why it stopped", () => {
  assert.equal(whyOf(node(item({ why: "needs the package to build" }))), "Needs the package to build");
  assert.equal(whyOf(node(item({ why: "npm needs it" }))), "npm needs it", "a command word stays lowercase");
  assert.equal(whyOf({ t: { ...thread, happened: "Stopped: the tests failed" }, group: "stopped", ask: { kind: "stopped" } }), "The tests failed");
  assert.equal(cap("perm-test.txt is new"), "perm-test.txt is new");
});
t("one strip of evidence per kind: the command, a web or tool tag, two diff lines, a plan's steps, the changed files", () => {
  assert.deepEqual(stripOf(node(item({ detail: { command: "npm i" } }))), { type: "command", text: "npm i" });
  assert.deepEqual(stripOf(node(item({ title: "Fetch a page", detail: { url: "https://example.com/a" } }))), { type: "url", text: "https://example.com/a", tag: "web" });
  assert.deepEqual(stripOf(node(item({ title: "Use a tool", detail: { mcp: { server: "figma", tool: "get_screenshot" } } }))), { type: "tool", text: "figma/get_screenshot", tag: "tool" });
  const diff = stripOf(node(item({ kind: "approval", title: "Change two files", detail: { diff: "--- a/x\n+++ b/x\n@@\n-old line\n+new line\n+another\n+third" } })));
  assert.deepEqual(diff, { type: "diff", lines: [{ sign: "-", text: "old line" }, { sign: "+", text: "new line" }] });
  const plan = stripOf(node(item({ kind: "approval", title: "Approve the plan", detail: { plan: "# Plan\n1. Read\n2. Write\n3. Test\n4. Ship" } })));
  assert.equal(plan.type, "plan"); assert.equal(plan.tag, "4 steps"); assert.equal(plan.more, true); assert.equal(plan.text.split("\n").length, 4);
  const files = stripOf(node(item({ kind: "integrity", title: "Files changed", detail: { changes: [{ path: "a.js", diff: "+x\n+y\n-z" }, { path: "b.js", diff: "" }], more: 3 } })));
  assert.deepEqual(files, { type: "paths", items: [{ path: "a.js", add: 2, del: 1 }, { path: "b.js", add: 0, del: 0 }], more: 3 });
  assert.equal(stripOf(node(item({ kind: "question", title: "Which?", detail: { questions: [] } }))), null);
});
t("chips: an item's risk_groups at their own tier (an old group takes the item's); a live ask's same reason for several paths is one chip", () => {
  const plain = chipsOf({ t: thread, risk: "notable", ask: { kind: "permission", title: "Run it", riskReasons: ["it reads outside this session's folder (/a)", "it reads outside this session's folder (/b)", "it fetches from example.com"] } });
  assert.deepEqual(plain, [{ tone: "warn", text: "It reads outside this session's folder", count: 2 }, { tone: "warn", text: "It fetches from example.com", count: 1 }]);
  const grouped = chipsOf(node(item({ risk: "destructive", risk_reasons: ["it deletes a protected path: 6 paths"], risk_groups: [{ kind: "destructive", text: "it deletes a protected path", count: 6, paths: [] }] })));
  assert.deepEqual(grouped, [{ tone: "err", text: "It deletes a protected path", count: 6 }]);
  const tiers = chipsOf(node(item({ risk: "destructive", risk_groups: [{ kind: null, text: "it reads credentials or private state", count: 1, paths: [] }, { kind: "notable", text: "it reads outside this session's folder", count: 2, paths: [] }, { kind: "routine", text: "it lists files", count: 1, paths: [] }] })));
  assert.deepEqual(tiers.map((c) => c.tone), ["err", "warn", ""]);
  assert.deepEqual(chipsOf(node(item({ risk_reasons: ["it fetches from example.com"], risk_groups: [] }))), [], "an item's chips are its groups, not its reason lines");
  const job = chipsOf(node(item({ kind: "create_job", title: "Schedule a job", detail: { schedule: "every Monday 19:00", job: { agent: "claude", model: "opus" } } })));
  assert.deepEqual(job.map((c) => c.text), ["every Monday 19:00", "claude · opus"]);
});
t("answers: the recommended one first (only with its reason), each keeping the index it sends, none picked", () => {
  const q = { options: [{ label: "Keep it" }, { label: "Move it", description: "It's faster", recommended: true, cost: "Takes 2 minutes" }, { label: "Drop it", recommended: true }] };
  const o = optionsOf(q);
  assert.deepEqual(o.map((x) => [x.label, x.index, x.recommended]), [["Move it", 1, true], ["Keep it", 0, false], ["Drop it", 2, false]]);
  assert.equal(o[0].cost, "Takes 2 minutes");
  assert.ok(o.every((x) => !("selected" in x) && !("checked" in x)), "no answer is pre-selected");
  assert.equal(optionsOf({ options: [{ label: "A", recommended: true }] })[0].recommended, false, "a recommendation without a reason isn't shown");
  const two = optionsOf({ options: [{ label: "A", description: "a", recommended: true }, { label: "B", description: "b", recommended: true }] });
  assert.equal(two.filter((x) => x.recommended).length, 1, "one suggestion at most");
});
t("number keys follow the order shown and skip the recommended answer; the card picks by them, never by index", () => {
  const o = optionsOf({ options: [{ label: "A" }, { label: "B", description: "why", recommended: true }, { label: "C" }] });
  assert.deepEqual(pickKeys(o), [0, 1, 2], "B leads with no key; A is 1, C is 2");
  assert.deepEqual(pickKeys(optionsOf({ options: Array.from({ length: 11 }, (_, i) => ({ label: String(i) })) })).slice(8), [9, 0, 0]);
  const src = readFileSync(new URL("../modules/decisions/keyboard.js", import.meta.url), "utf8");
  assert.match(src, /querySelector\(`button\[data-pick="\$\{k\}"\]`\)/);
  assert.doesNotMatch(src, /querySelector\(`\[data-iopt="\$\{\+k - 1\}"\]`\)/, "a key never takes an answer by its index");
  assert.doesNotMatch(src, /c-sug|suggestFor/, "the old suggestion line is gone");
});
t("every kind has a strip and buttons, and every ask maps to a kind", () => {
  const STRIPS = new Set(["command", "url", "tool", "diff", "plan", "paths", "files", "error", "none"]), ACTS = new Set(["binary", "answer", "words", "stopped"]);
  for (const [k, v] of Object.entries(KINDS)) { assert.ok(STRIPS.has(v.strip), `${k}: strip`); assert.ok(ACTS.has(v.acts), `${k}: acts`); }
  const asks = [
    node(item({ detail: { command: "ls" } })), node(item({ detail: { url: "https://x" } })), node(item({ detail: { mcp: "a/b" } })), node(item({ detail: { kind: "read", paths: ["/a"] } })),
    node(item({ kind: "approval", detail: { diff: "+a" } })), node(item({ kind: "approval", detail: { plan: "1. a" } })), node(item({ kind: "action", detail: { command: "open the app" } })),
    node(item({ kind: "question", detail: { questions: [{ question: "Which?", options: [{ label: "A" }] }] } })),
    node(item({ kind: "question", detail: { questions: [{ question: "Key?", secret: true }] } })),
    node(item({ kind: "create_project" })), node(item({ kind: "create_job" })), node(item({ kind: "integrity" })), node(item({ kind: "usage" })), node(item({ kind: "suggestion" })),
    node(item({ kind: "something_new" })),
    { t: thread, risk: "notable", ask: { kind: "question", title: "It's waiting for your reply", replyOnly: true, live: true } },
    { t: thread, risk: "stopped", group: "stopped", ask: { kind: "stopped", title: "Fix" } },
  ];
  const kinds = asks.map(kindOf);
  assert.deepEqual(kinds, ["command", "web", "tool", "file", "change", "plan", "action", "question", "secret", "create_project", "create_job", "integrity", "usage", "suggestion", "approval", "reply", "stopped"]);
  assert.deepEqual([...new Set(kinds)].sort(), Object.keys(KINDS).sort(), "every kind in the table is reachable");
  for (const n of asks) { assert.ok(actsOf(n, { canResolve: true }).some((b) => b.role === "primary") || isOnePress(n), `${kindOf(n)}: a way to answer`); stripOf(n); chipsOf(n); headOf(n); }
});
t("buttons: the item's own words; a destructive yes is always a hold; Later sits in the row for a big one", () => {
  assert.deepEqual(actsOf(node(item({ detail: { command: "ls" } }))), [{ act: "allow", label: "Allow once", role: "primary" }, { act: "back", label: "Deny", role: "secondary" }]);
  const d = actsOf(node(item({ risk: "destructive", detail: { command: "rm -rf x" } }), { effort: "think" }));
  assert.deepEqual(d.map((b) => b.act), ["hold", "back", "later"]);
  assert.equal(d[0].label, "Hold to allow");
  assert.equal(actsOf({ t: thread, risk: "destructive", ask: { kind: "approval", title: "Drop the table" } })[0].act, "hold", "a legacy destructive ask holds too");
  for (const n of [node(item({ risk: "destructive", kind: "approval", options: [{ decision: "approve", label: "Approve" }, { decision: "send_back", label: "Send back", note: true }] }))]) assert.equal(actsOf(n)[0].act, "hold");
  const reply = { t: thread, risk: "notable", ask: { kind: "question", title: "Done?", replyOnly: true, live: true } };
  assert.deepEqual(actsOf(reply, { canResolve: true }).map((b) => b.act), ["reply", "done"]);
  assert.deepEqual(actsOf(reply).map((b) => b.act), ["reply"], "Done only where the world can resolve");
  assert.deepEqual(actsOf({ ...reply, ask: { ...reply.ask, paused: true } }, { canResolve: true }).map((b) => b.act), ["reply"]);
  assert.deepEqual(actsOf({ t: thread, risk: "stopped", group: "stopped", ask: { kind: "stopped" } }).map((b) => b.act), ["retry", "note-reply"]);
});
t("questions: one plain choice is one press; several, multi, secret or a hold need the form and Send", () => {
  const q = (qs, over = {}) => node(item({ kind: "question", title: "Which?", detail: { questions: qs }, options: [{ decision: "answer", label: "Answer" }], ...over }));
  const one = q([{ question: "Which?", options: [{ label: "A" }, { label: "B" }] }]);
  assert.equal(isOnePress(one), true); assert.deepEqual(actsOf(one).map((b) => b.act), ["reply"]);
  const multi = q([{ question: "Which?", multi: true, options: [{ label: "A" }] }]);
  assert.equal(isOnePress(multi), false); assert.deepEqual(actsOf(multi).map((b) => [b.act, b.label]), [["submit", "Send answer"]]);
  assert.deepEqual(actsOf(q([{ question: "A?", options: [{ label: "x" }] }, { question: "B?" }])).map((b) => b.label), ["Send answers"]);
  const held = q([{ question: "Which?", options: [{ label: "A" }] }], { risk: "destructive" });
  assert.equal(isOnePress(held), false); assert.equal(actsOf(held)[0].act, "hold");
  const secret = q([{ question: "Key?", secret: true }]);
  assert.deepEqual(actsOf(secret, { refused: true }), [{ act: "thread", label: "Open the thread", role: "primary" }]);
});
t("an item that left unanswered: its one line in Space's words, else a plain one", () => {
  assert.deepEqual(goneLine({ state: "withdrawn", reason: "superseded", why: "the agent found another way" }), { head: "Withdrawn", text: "The agent found another way" });
  assert.deepEqual(goneLine({ state: "expired", reason: "timeout", why: "" }), { head: "Expired", text: "No longer needed" });
  assert.deepEqual(goneLine({ state: "withdrawn" }), { head: "Withdrawn", text: "No longer needed" }, "a reason code alone is never shown");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
