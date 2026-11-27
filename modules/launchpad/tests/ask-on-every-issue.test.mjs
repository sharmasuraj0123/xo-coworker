import assert from "node:assert/strict";
import test from "node:test";
import { installViews } from "../views.js";

const issueOf = (html) => (html.match(/data-lp="ask-fix" data-issue="([^"]*)"/) || [])[1] ?? null;
function view(sc, s) {
  const rec = { check: { repo: { branch: "main" }, app: null, blockers: [], warnings: [], github: { connected: true, workflow: true } }, run: null, err: null, asked: null, asking: false, askErr: null, copied: 0, menu: false, warn: null, ...s };
  const L = { S: {}, proj: () => rec, nameOf: () => "backups", findThread: () => null, screen: () => sc, summary: () => ({ tone: "", words: "" }) };
  installViews(L);
  return L.bodyHtml("backups").html;
}
const run = (error) => ({ steps: {}, error });

test("every Launchpad failure offers Ask an agent, telling it what went wrong", () => {
  assert.match(issueOf(view("check-failed", { err: { message: "Space timed out" } })), /Space timed out/);
  assert.match(issueOf(view("failed", { run: run({ code: "build_failed", message: "npm ci failed", step: "RUN npm ci" }) })), /npm ci failed \(in RUN npm ci\)/);
  const pushed = view("failed", { run: run({ code: "push_rejected", message: "The push was refused", action: "retry" }) });
  assert.match(issueOf(pushed), /The push was refused/);
  assert.match(pushed, /data-lp="retry"/, "the failure's own next step stays beside it");
  const port = view("failed", { run: run({ code: "health_check_failed", message: "Nothing answered", port: 3000, declared: 8080 }) });
  assert.match(port, /data-lp="fix-port"/, "the one-press fix stays the lit button");
  assert.match(issueOf(port), /Nothing answered/);
  const sick = view("live", { check: { repo: { branch: "main" }, blockers: [], warnings: [], app: { id: "a", name: "backups", host: "b.example", url: "https://b.example", status: "unhealthy" } } });
  assert.match(issueOf(sick), /aren&#39;t answering \(status: unhealthy\)/);
});

test("Ask an agent isn't offered twice: not once a thread is asked, not for a deploy you stopped", () => {
  assert.equal(issueOf(view("check-failed", { err: { message: "x" }, asked: { thread: "t1", title: "Fix it", since: 0 } })), null);
  assert.equal(issueOf(view("failed", { run: run({ code: "cancelled", message: "Stopped" }) })), null);
  const healthy = view("live", { check: { repo: { branch: "main" }, blockers: [], warnings: [], app: { id: "a", name: "backups", host: "b.example", url: "https://b.example", status: "running" } } });
  assert.equal(issueOf(healthy), null);
});

test("what Launchpad still needs is a plain list, not rows of the card group", () => {
  const html = view("needs", { check: { repo: { branch: "main" }, blockers: [], warnings: [], missing: [{ what: "a git repository", ok: false }] } });
  assert.match(html, /<ul class="lp-check"><li class="is-no">/);
});
