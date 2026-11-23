// GitHub, a page of the panel: a project's issues and pull requests, beside its chat. Prototype for review.
import { ICON, ARC, xi } from "./ui.js";
import { esc } from "./util.js";
import { renderMarkdown } from "./markdown.js";

const DAY = 86400000;
const since = (iso) => { const t = Date.parse(iso || ""); if (!Number.isFinite(t)) return ""; const d = (Date.now() - t) / DAY; return d < 1 / 24 ? `${Math.max(1, Math.round(d * 1440))}m` : d < 1 ? `${Math.round(d * 24)}h` : d < 14 ? `${Math.round(d)}d` : d < 60 ? `${Math.round(d / 7)}w` : `${Math.round(d / 30)}mo`; };
const longAgo = (iso) => { const s = since(iso); return s ? s.replace(/m$/, " minutes").replace(/h$/, " hours").replace(/d$/, " days").replace(/w$/, " weeks").replace(/mo$/, " months") + " ago" : ""; };
const IC = { open: xi("state-idle"), closed: xi("check-circle"), pr: xi("pull-request"), merged: xi("merge"), ok: xi("check"), fail: xi("x-circle"), run: xi("spinner"), comment: xi("comment"), ext: xi("external-link"), sync: xi("sync"), branch: xi("branch"), thread: xi("thread") };

const SAMPLE = {
  prs: (repo) => [
    { number: 291, title: "Projects chat: relay coordinator notes into the thread they name", state: "open", author: "dwivedi-ai", head: "xo/thread-7c1f02", base: "main", updated_at: ago(0.2), checks: "fail", failing: "tests (3.12)", review: "changes", comments: 4, thread: "Relay notes into threads", url: `https://github.com/${repo}/pull/291` },
    { number: 289, title: "Storm: enforce deny rules in auto mode", state: "open", author: "sharmasuraj0123", head: "storm-deny-auto", base: "main", updated_at: ago(1.1), checks: "ok", review: "requested", comments: 2, url: `https://github.com/${repo}/pull/289` },
    { number: 288, title: "Session status resets after a server restart", state: "open", author: "dwivedi-ai", head: "xo/thread-a41be0", base: "main", updated_at: ago(2.4), checks: "run", review: null, draft: true, comments: 0, thread: "Session status after restart", url: `https://github.com/${repo}/pull/288` },
    { number: 284, title: "Doctor: report the GitHub poller's budget", state: "merged", author: "sharmasuraj0123", head: "doctor-gh-budget", base: "main", updated_at: ago(6), checks: "ok", review: "approved", comments: 1, url: `https://github.com/${repo}/pull/284` },
    { number: 281, title: "Inbox: one feeder per source", state: "closed", author: "dwivedi-ai", head: "inbox-feeders", base: "main", updated_at: ago(9), checks: "ok", review: null, comments: 3, url: `https://github.com/${repo}/pull/281` },
  ],
  body: "When the coordinator relays a note to an existing thread, the note never shows in that thread's timeline. The thread does receive it (its next turn acts on it) but the owner can't see what it was told.\n\n**To reproduce**\n1. Start a thread from the project chat.\n2. Ask the coordinator to pass it a note.\n3. Open the thread: the note isn't there.\n\nExpected: the relay shows as a quoted note from the coordinator, like a spawn brief.",
  comments: [
    { author: "sharmasuraj0123", at: ago(3), text: "Confirmed on 0.14. The relay is written to the session, not to the thread's message log." },
    { author: "dwivedi-ai", at: ago(1), text: "The panel's Thread page will need the same fix: it reads the same log." },
  ],
};
function ago(days) { return new Date(Date.now() - days * DAY).toISOString(); }

export function createGhPage({ stage, api, view, projectOf, go, announce = () => {} }) {
  const G = { tab: "issues", data: new Map(), folds: { closed: true }, item: null };
  const pane = document.createElement("section");
  pane.className = "gh";
  pane.setAttribute("aria-label", "GitHub");
  const detail = document.createElement("section");
  detail.className = "gh gh-d";

  const project = () => projectOf(view());
  async function load(p, { refresh = false } = {}) {
    if (!p) return null;
    const had = G.data.get(p);
    if (had && !refresh) return had;
    let issues = null, status = null;
    try { issues = await api.githubIssues(p, refresh); } catch { issues = { state: "error", issues: [] }; }
    try { status = await api.githubStatus(); } catch { status = null; }
    const d = { issues, status, prs: issues.repo ? SAMPLE.prs(issues.repo) : [] };
    G.data.set(p, d);
    return d;
  }
  const repoOf = (p) => G.data.get(p)?.issues?.repo || null;

  const row = (r) => `<li><button type="button" class="ag-r${r.idle ? " is-idle" : ""}" data-gh-open="${esc(r.key)}" aria-label="${esc(`${r.title}. ${r.sub}`)}">` +
    `<span class="ag-ic gh-ic is-${r.tone}" aria-hidden="true">${r.icon}${r.mark || ""}</span>` +
    `<span class="ag-t"><b>${esc(r.title)}</b><span class="ag-activity"><span class="ag-doing">${r.subHtml}</span></span></span>` +
    `<span class="ag-tm"><span class="ag-when">${esc(since(r.at))}</span></span></button></li>`;
  const group = (k, word, rows, cap = Infinity) => {
    if (!rows.length) return "";
    const folded = !!G.folds[k];
    const head = `<li class="tg-h"><button type="button" class="tg-b" data-gh-fold="${k}" aria-expanded="${!folded}"><span class="tg-w">${esc(word)}</span><span class="fr-n">${rows.length}</span><span class="tg-ch" aria-hidden="true">${ICON.chevron}</span></button></li>`;
    return head + (folded ? "" : rows.slice(0, cap).map(row).join(""));
  };
  const dot = `<span class="gh-sep" aria-hidden="true">·</span>`;

  function issueRows(d) {
    const list = (d.issues.issues || []).map((i, n) => {
      const worked = i.in_progress || (i.state === "open" && n === 0);
      return { key: `i${i.number}`, title: i.title, at: i.updated_at, tone: i.state === "open" ? "open" : "done", idle: i.state !== "open",
        icon: i.state === "open" ? IC.open : IC.closed, mark: worked ? ARC : "", worked, state: i.state,
        sub: `#${i.number}`, subHtml: `#${i.number}${worked ? `${dot}<span class="gh-th">${IC.thread}a thread is on it</span>` : i.assignees?.length ? `${dot}${esc(i.assignees[0].login)}` : ""}` };
    });
    return [group("worked", "In a thread", list.filter((r) => r.worked)), group("open", "Open", list.filter((r) => !r.worked && r.state === "open")), group("closed", "Closed", list.filter((r) => r.state !== "open"), 5)].join("");
  }
  const CHECK = { ok: [IC.ok, "is-ok", "Checks pass"], fail: [IC.fail, "is-err", "Checks failing"], run: [IC.run, "is-run", "Checks running"] };
  const REVIEW = { requested: "Your review", changes: "Changes asked", approved: "Approved" };
  function prRows(d) {
    const list = d.prs.map((p) => {
      const c = CHECK[p.checks], needs = p.state === "open" && (p.review === "requested" || p.checks === "fail");
      return { key: `p${p.number}`, title: p.title, at: p.updated_at, state: p.state, needs, tone: p.state === "merged" ? "merged" : p.state === "open" ? (p.draft ? "draft" : "open") : "done", idle: p.state !== "open",
        icon: p.state === "merged" ? IC.merged : IC.pr, mark: p.thread && p.state === "open" ? ARC : needs ? `<i class="ag-wait ag-need">${ICON.diamond}</i>` : "",
        sub: `#${p.number}`, subHtml: `#${p.number}${dot}${p.draft ? "Draft" + dot : ""}${c && p.state === "open" ? `<span class="gh-ck ${c[1]}" title="${c[2]}">${c[0]}</span>` : ""}${p.review && p.state === "open" ? `${esc(REVIEW[p.review])}${dot}` : ""}<code class="gh-br">${esc(p.head)}</code>` };
    });
    return [group("needs", "Needs you", list.filter((r) => r.needs)), group("popen", "Open", list.filter((r) => !r.needs && r.state === "open")), group("pdone", "Merged and closed", list.filter((r) => r.state !== "open"), 5)].join("");
  }
  function notice(d) {
    const st = d.status, bad = st && st.status !== "connected" && !st.valid;
    if (!bad) return "";
    const when = longAgo(d.issues.fetched_at);
    return `<div class="gh-note" role="status">${ICON.warn}<span>GitHub's sign-in has expired.${when ? ` This is what it said ${esc(when)}.` : ""}</span><button type="button" class="btn gh-fix" data-gh-reconnect>Reconnect</button></div>`;
  }
  function listHtml(d) {
    if (!d) return `<p class="fr-none">Reading GitHub…</p>`;
    if (!d.issues.repo) return `<p class="fr-none">This project isn't on GitHub.</p>`;
    const nOpen = (d.issues.issues || []).filter((i) => i.state === "open").length, nPr = d.prs.filter((p) => p.state === "open").length;
    const tab = (k, word, n) => `<button type="button" class="fr-t${G.tab === k ? " is-on" : ""}" role="tab" aria-selected="${G.tab === k}" data-gh-tab="${k}">${word}<span class="fr-n">${n || ""}</span></button>`;
    return `<header class="fr-h gh-h"><div class="fr-tabs" role="tablist" aria-label="Issues or pull requests">${tab("issues", "Issues", nOpen)}${tab("prs", "Pull requests", nPr)}</div>` +
      `<div class="fr-a"><a class="fr-ib" href="https://github.com/${esc(d.issues.repo)}/${G.tab === "prs" ? "pulls" : "issues"}" target="_blank" rel="noopener" title="Open on GitHub" aria-label="Open on GitHub">${IC.ext}</a><button type="button" class="fr-ib" data-gh-refresh title="Read GitHub again" aria-label="Read GitHub again">${IC.sync}</button></div></header>` +
      notice(d) + `<div class="fr-b gh-b"><ul class="ag-list tg-list">${G.tab === "issues" ? issueRows(d) : prRows(d)}</ul></div>`;
  }

  function itemHtml(d, key) {
    const n = Number(key.slice(1)), isPr = key[0] === "p";
    const it = isPr ? d.prs.find((p) => p.number === n) : (d.issues.issues || []).find((i) => i.number === n);
    if (!it) return `<p class="fr-none">Not found.</p>`;
    const state = isPr ? it.state : it.state, word = state === "merged" ? "Merged" : state === "open" ? (it.draft ? "Draft" : "Open") : "Closed";
    const badge = `<span class="badge gh-st is-${state === "open" ? "open" : state}">${state === "merged" ? IC.merged : isPr ? IC.pr : state === "open" ? IC.open : IC.closed}${word}</span>`;
    const by = it.author || it.assignees?.[0]?.login || "sharmasuraj0123";
    const worked = isPr ? !!it.thread : (d.issues.issues || []).indexOf(it) === 0 && it.state === "open";
    const checks = isPr ? `<section class="gh-sec"><h3 class="gh-k">Checks</h3><ul class="ch-list">${[["tests (3.12)", it.checks === "fail" ? "fail" : it.checks], ["tests (3.11)", it.checks === "run" ? "run" : "ok"], ["lint", "ok"]].map(([name, s]) => `<li><span class="ch-r gh-ckr"><span class="ch-i gh-ck ${CHECK[s][1]}">${CHECK[s][0]}</span><span class="ch-n">${esc(name)}</span><span class="ch-m">${s === "fail" ? "failed" : s === "run" ? "running" : "passed"}</span></span></li>`).join("")}</ul></section>` +
      `<section class="gh-sec"><h3 class="gh-k">Changes</h3><ul class="ch-list"><li><button type="button" class="ch-r"><span class="ch-i">${ICON.changes || xi("changes")}</span><span class="ch-copy"><span class="ch-n">7 files</span><span class="ch-path">${esc(it.head)} → ${esc(it.base)}</span></span><span class="ch-m"><span class="gh-add">+214</span> <span class="gh-del">−38</span></span></button></li></ul></section>` : "";
    const act = worked
      ? `<button type="button" class="btn btn-pri" data-gh-thread>${IC.thread}Open its thread</button>`
      : `<button type="button" class="btn btn-pri" data-gh-work>${IC.thread}${isPr ? "Review it in a thread" : "Work on it in a thread"}</button>`;
    return `<div class="gh-dh"><h2 class="gh-title">${esc(it.title)} <span class="gh-num">#${n}</span></h2>` +
      `<p class="gh-meta">${badge}<span>${esc(by)}${dot}${esc(longAgo(it.updated_at))}</span>${it.comments || !isPr ? `${dot}<span class="gh-cm">${IC.comment}${isPr ? it.comments : SAMPLE.comments.length}</span>` : ""}</p>` +
      `<div class="gh-acts">${act}<a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener">${IC.ext}Open on GitHub</a></div></div>` +
      checks +
      `<section class="gh-sec"><div class="prose gh-body">${renderMarkdown(SAMPLE.body)}</div></section>` +
      `<section class="gh-sec"><h3 class="gh-k">Comments</h3><ol class="gh-cms">${SAMPLE.comments.map((c) => `<li class="gh-c"><p class="gh-ch"><b>${esc(c.author)}</b>${dot}<span>${esc(longAgo(c.at))}</span></p><div class="prose">${renderMarkdown(c.text)}</div></li>`).join("")}</ol></section>`;
  }

  function paint() {
    const d = G.data.get(project());
    pane.innerHTML = listHtml(d);
  }
  function paintItem() {
    const d = G.data.get(project());
    detail.innerHTML = `<div class="fr-b gh-b gh-db">${d && G.item ? itemHtml(d, G.item) : ""}</div>`;
  }

  pane.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.ghTab) { G.tab = t.dataset.ghTab; paint(); return; }
    if (t.dataset.ghFold) { G.folds[t.dataset.ghFold] = !G.folds[t.dataset.ghFold]; paint(); return; }
    if (t.hasAttribute("data-gh-refresh")) { await load(project(), { refresh: true }); paint(); announce("Read GitHub again."); return; }
    if (t.dataset.ghOpen) { G.item = t.dataset.ghOpen; stage.show("ghitem", G.item, { focus: true }); }
  });

  stage.page("github", {
    title: () => repoOf(project()) || "GitHub",
    mount: (host) => host.append(pane),
    onShow: async () => { paint(); await load(project()); paint(); },
  });
  stage.page("ghitem", {
    over: true,
    title: (key) => `${key[0] === "p" ? "Pull request" : "Issue"} #${key.slice(1)}`,
    backTo: () => repoOf(project()) || "GitHub",
    mount: (host) => host.append(detail),
    onShow: (key) => { G.item = key; paintItem(); },
  });

  return {
    show: async () => { await load(project()); stage.show("github", "github", { focus: true }); },
    /** The panel's GitHub button shows only for a project with a GitHub remote. */
    async has(p) { const d = await load(p); return !!d?.issues?.repo; },
    get isOpen() { return stage.pageShown?.name === "github" || stage.pageShown?.name === "ghitem"; },
  };
}
