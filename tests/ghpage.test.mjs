// The panel's GitHub page: Space's issue rows and pull requests read into rows, nothing invented when a field is missing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dom, settle } from "./lib/dom.mjs";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const R = new URL("../", import.meta.url);
const { createGhPage, issueOf, prOf, issueRow, prRow } = await import(new URL("modules/github/page.js", R));
const { relativeShort: since, relativeWords: longAgo } = await import("../core/platform/relative-time.js");
const { api } = await import("../core/platform/api.js");
const { issues: fixture } = JSON.parse(readFileSync(new URL("core/platform/tests/fixtures/connector-responses.json", R), "utf8"));
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

async function githubPage({ pulls, item, failure, retryPulls = false }) {
  const { document, window } = await dom("<div id='panel'></div>");
  const panel = document.getElementById("panel");
  const project = "demo", base = `/api/xo-projects/${project}/github`;
  const issue = { ...fixture.issues[0], title: "Issue from list", url: "https://github.com/o/r/issues/1", assignees: [] };
  const pr = { number: 2, title: "Pull from list", url: "https://github.com/o/r/pull/2", state: "open" };
  const requests = [];
  let recovering = false;
  globalThis.fetch = async (url) => {
    const { pathname: path } = new URL(String(url), "http://local/");
    requests.push(path);
    if (path === `${base}/issues`) return Response.json({ ...fixture, repo: "o/r", issues: [issue] });
    if (path === `${base}/pulls` && retryPulls && !recovering) return Response.json({ detail: "Try again" }, { status: 500 });
    if (path === `${base}/pulls` && pulls) return Response.json({ pulls: [pr] });
    if (path === "/api/connectors/github/status") return Response.json({ status: "connected", username: "sample-user" });
    if (failure && path === `${base}/issues/1`) return Response.json({ detail: failure.detail }, { status: failure.status });
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
  const fold = panel.querySelector('[data-gh-fold="open"]');
  fold.focus();
  click('[data-gh-fold="open"]');
  assert.equal(document.activeElement === fold, true, "the focused fold survives the redraw");
  assert.equal(fold.getAttribute("aria-expanded"), "false");
  click('[data-gh-fold="open"]');
  if (retryPulls) {
    assert.ok(!panel.querySelector('[data-gh-tab="prs"]'), "a failed pull list leaves the issue list usable");
    assert.match(panel.textContent, /Issue from list/);
    recovering = true;
    click("[data-gh-refresh]");
    await settle();
    click('[data-gh-tab="prs"]');
    assert.match(panel.textContent, /Pull from list/, "refresh recovers a pull list that originally returned 500");
    gh.dispose();
    return;
  }
  if (!pulls) {
    assert.ok(requests.includes(`${base}/pulls`));
    assert.ok(!panel.querySelector("[data-gh-tab]"), "no pull request tabs when the list route is absent");
    assert.match(panel.textContent, /Issue from list/);
    assert.equal(requests.filter((path) => path === `${base}/pulls`).length, 1, "a confirmed missing route is cached");
  }
  if (!item) return;
  const pull = item === "p2";
  if (pull) click('[data-gh-tab="prs"]');
  const original = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  const failures = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error.code) });
  try {
    click(`[data-gh-open="${item}"]`);
    await settle();
    assert.deepEqual(failures, failure?.status === 500 ? ["http_500"] : []);
  } finally {
    if (original) Object.defineProperty(globalThis, "reportError", original);
    else Reflect.deleteProperty(globalThis, "reportError");
  }
  const detailPath = `${base}/${pull ? "pulls/2" : "issues/1"}`;
  assert.equal(requests.filter((path) => path === detailPath).length, 1);
  assert.match(panel.querySelector(".gh-title").textContent, pull ? /Pull from list/ : /Issue from list/);
  assert.ok(!panel.querySelector(".gh-body"), "the base row is useful even without optional details");
  assert.ok(panel.querySelector(`a[href="${pull ? pr.url : issue.url}"]`), "the GitHub link remains available");
  if (failure) {
    assert.match(panel.textContent, /Couldn't read this item from GitHub/);
    return;
  }
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
await githubPage({ pulls: false, item: "i1", failure: { status: 500, detail: "Failed" } });
await githubPage({ pulls: false, item: "i1", failure: { status: 404, detail: { code: "not_found", message: "Issue removed" } } });
{
  const original = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  const failures = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error.code) });
  try {
    await githubPage({ pulls: true, retryPulls: true });
    assert.ok(failures.length > 0 && failures.every((code) => code === "http_500"));
  } finally {
    if (original) Object.defineProperty(globalThis, "reportError", original);
    else Reflect.deleteProperty(globalThis, "reportError");
  }
}

{
  const { document } = await dom('<div id="panel"><button>New project</button></div>');
  const panel = document.getElementById("panel");
  const destination = panel.querySelector("button");
  const pages = new Map();
  let view = "p:slow";
  let pending = Promise.withResolvers();
  const gh = createGhPage({
    stage: {
      page(name, config) { pages.set(name, config); },
      show(name) {
        panel.replaceChildren();
        pages.get(name).mount(panel);
        panel.querySelector("section").focus();
      },
    },
    api: {
      githubIssues: () => pending.promise,
      githubPulls: async () => ({ pulls: [] }),
      githubStatus: async () => ({ valid: true }),
    },
    view: () => view,
    projectOf: (place) => place.slice(2),
  });
  const opening = gh.show();
  await settle();
  view = "p:other";
  destination.focus();
  pending.resolve({ repo: "o/slow", issues: [] });
  await opening;
  assert.ok(document.activeElement === destination, "a late open leaves the new project and its focus in place");

  view = "p:roundtrip";
  pending = Promise.withResolvers();
  const roundtrip = gh.show();
  await settle();
  gh.leave();
  view = "p:other";
  view = "p:roundtrip";
  pending.resolve({ repo: "o/roundtrip", issues: [] });
  await roundtrip;
  assert.ok(document.activeElement === destination, "leaving invalidates the open even after returning to the original view");
  gh.dispose();
}

{
  const { document } = await dom("<div id='panel'></div>");
  const panel = document.getElementById("panel");
  const pages = new Map();
  const pending = Promise.withResolvers();
  const issues = [];
  const productionApi = {
    githubIssues(_project, _refresh, { signal }) {
      issues.push(signal);
      return pending.promise;
    },
    githubStatus: async () => ({ valid: true }),
    githubPulls: async () => ({ pulls: [] }),
  };
  let shown = 0;
  const gh = createGhPage({
    api: productionApi,
    stage: {
      page(name, config) { pages.set(name, config); },
      show() { shown++; },
    },
    view: () => "p:demo",
    projectOf: () => "demo",
  });
  pages.get("github").mount(panel);
  const opening = gh.show();
  await settle();
  const available = gh.has("demo");
  await settle();
  assert.equal(issues.length, 1, "opening and checking the button share the project's in-flight read");
  gh.dispose();
  assert.equal(issues[0].aborted, true);
  pending.resolve({ repo: "o/r", issues: [] });
  assert.equal(await available, false);
  await opening;
  assert.equal(shown, 0, "a late read cannot open the panel after disposal");
}

console.log(`${passed} passed`);
