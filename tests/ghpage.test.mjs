// The panel's GitHub page: Space's issue rows and pull requests read into rows, nothing invented when a field is missing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dom, settle } from "./lib/dom.mjs";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const R = new URL("../", import.meta.url);
const { createGhPage, since, longAgo, issueOf, prOf, issueRow, prRow } = await import(new URL("modules/github/page.js", R));
const { api } = await import("../core/platform/api.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const NOW = Date.parse("2026-11-23T16:00:00Z");

t("ages read short in a row and in words on a page", () => {
  assert.equal(since("2026-11-23T15:58:00Z", NOW), "2m");
  assert.equal(since("2026-11-23T11:00:00Z", NOW), "5h");
  assert.equal(since("2026-11-18T16:00:00Z", NOW), "5d");
  assert.equal(since("2026-10-19T16:00:00Z", NOW), "5w");
  assert.equal(since("", NOW), "");
  assert.equal(longAgo("2026-11-22T16:00:00Z", NOW), "1 day ago");
  assert.equal(longAgo("2026-11-18T16:00:00Z", NOW), "5 days ago");
});

t("a mirror issue as Space serves it today: no author, no comment count, so neither is drawn", () => {
  const i = issueOf({ node_id: "I_1", number: 257, title: "Status stays running", state: "open", assignees: [], labels: null, url: "https://github.com/o/r/issues/257", updated_at: "2026-10-19T14:16:05Z", adopted: false, in_progress: false });
  assert.equal(i.author, null);
  assert.equal(i.comments, null);
  const r = issueRow(i);
  assert.equal(r.sub.includes("<img"), false, "no avatar without one");
  assert.equal(r.sub.includes("gh-cm"), false, "no comment count without one");
  assert.equal(r.tone, "open");
});

t("an issue with an author, comments and a thread on it", () => {
  const i = issueOf({ number: 9, title: "x", state: "open", author: { login: "ada", avatar_url: "https://avatars.githubusercontent.com/u/1" }, comments: 3, in_progress: true });
  const r = issueRow(i);
  assert.equal(r.sub.includes('src="https://avatars.githubusercontent.com/u/1"'), true);
  assert.equal(r.sub.includes(">3</span>"), true);
  assert.equal(r.mark.length > 0, true, "the working arc on the tile");
});

t("a pull request in GitHub's own spelling: checks, review, conflict and size", () => {
  const p = prOf({ number: 291, title: "Relay notes", state: "OPEN", isDraft: false, author: { login: "ada", avatarUrl: "https://a/u" }, headRefName: "feat", baseRefName: "main",
    statusCheckRollup: "FAILURE", reviewDecision: "CHANGES_REQUESTED", mergeable: "CONFLICTING", additions: 1240, deletions: 38, changedFiles: 7 });
  assert.equal(p.checks, "fail");
  assert.equal(p.review, "changes");
  assert.equal(p.conflict, true);
  assert.equal(p.base, "main");
  const r = prRow(p);
  assert.equal(r.right.includes("+1.2k"), true);
  assert.equal(r.right.includes("−38"), true);
  assert.equal(r.sub.includes("Conflicts with main"), true);
  assert.equal(r.sub.includes("Checks failing"), true);
  assert.equal(r.mark.includes("ag-need"), true, "needs you");
});

t("a pull request in snake_case, merged: no status marks, no needs-you", () => {
  const p = prOf({ number: 3, title: "y", state: "merged", is_draft: false, head: "a", base: "main", checks: "SUCCESS", review_decision: "APPROVED", mergeable: "MERGEABLE", additions: 1, deletions: 0 });
  assert.equal(p.state, "merged");
  const r = prRow(p);
  assert.equal(r.sub.includes("gh-i is-"), false);
  assert.equal(r.mark, "");
  assert.equal(r.tone, "merged");
});

t("a pull request without sizes shows no size", () => {
  assert.equal(prRow(prOf({ number: 4, title: "z", state: "open" })).right, "");
});

t("titles and logins are escaped", () => {
  const r = issueRow(issueOf({ number: 1, title: "<b>x</b>", state: "open", author: { login: '"><script>', avatar_url: "https://a/u" } }));
  assert.equal(r.sub.includes("<script>"), false);
});

t("the page's styles use the app's tokens, never a raw colour", () => {
  const css = readFileSync(new URL("css/panel.css", R), "utf8");
  const mine = css.split("\n").filter((l) => /^\.gh[-. {]/.test(l)).join("\n");
  assert.equal(mine.length > 0, true);
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgb\(/.test(mine), false);
});

async function githubPage({ pulls, item }) {
  const { document, window } = await dom("<div id='panel'></div>");
  const panel = document.getElementById("panel");
  const project = "demo", base = `/api/xo-projects/${project}/github`;
  const issue = { number: 1, title: "Issue from list", url: "https://github.com/o/r/issues/1", state: "open" };
  const pr = { number: 2, title: "Pull from list", url: "https://github.com/o/r/pull/2", state: "open" };
  const requests = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url), "http://local/").pathname;
    requests.push(path);
    if (path === `${base}/issues`) return Response.json({ repo: "o/r", issues: [issue] });
    if (path === `${base}/pulls` && pulls) return Response.json({ pulls: [pr] });
    if (path === "/api/connectors/github/status") return Response.json({ status: "connected" });
    return Response.json({ detail: "Not Found" }, { status: 404 });
  };
  const pages = new Map();
  let showing;
  const click = (selector) => {
    const button = panel.querySelector(selector);
    assert.ok(button, selector);
    button.dispatchEvent(new window.Event("click", { bubbles: true }));
  };
  const gh = createGhPage({
    api,
    stage: {
      page(name, config) { pages.set(name, config); },
      show(name, key) {
        const page = pages.get(name);
        panel.replaceChildren();
        page.mount(panel);
        showing = page.onShow(key);
      },
    },
    view: () => "p:demo",
    projectOf: () => project,
  });
  await gh.show();
  await showing;
  if (!pulls) {
    assert.ok(requests.includes(`${base}/pulls`));
    assert.ok(!panel.querySelector("[data-gh-tab]"), "no pull request tabs when the list route is absent");
    assert.match(panel.textContent, /Issue from list/);
  }
  if (!item) return;
  const pull = item === "p2";
  if (pull) click('[data-gh-tab="prs"]');
  click(`[data-gh-open="${item}"]`);
  await settle();
  const detailPath = `${base}/${pull ? "pulls/2" : "issues/1"}`;
  assert.equal(requests.filter((path) => path === detailPath).length, 1);
  assert.match(panel.querySelector(".gh-title").textContent, pull ? /Pull from list/ : /Issue from list/);
  assert.ok(!panel.querySelector(".gh-body"), "the base row is useful even without optional details");
  assert.ok(panel.querySelector(`a[href="${pull ? pr.url : issue.url}"]`), "the GitHub link remains available");
  await gh.show();
  await showing;
  if (pull) click('[data-gh-tab="prs"]');
  click(`[data-gh-open="${item}"]`);
  await settle();
  assert.equal(requests.filter((path) => path === detailPath).length, 1, "an unavailable route is not retried");
}

await githubPage({ pulls: false });
await githubPage({ pulls: false, item: "i1" });
await githubPage({ pulls: true, item: "p2" });

console.log(`${passed} passed`);
