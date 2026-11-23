// GitHub, a page of the panel: a project's issues and pull requests, beside its chat. Prototype for review.
import { ICON, ARC, xi } from "./ui.js";
import { esc } from "./util.js";
import { renderMarkdown } from "./markdown.js";

const DAY = 86400000;
const since = (iso) => { const t = Date.parse(iso || ""); if (!Number.isFinite(t)) return ""; const d = (Date.now() - t) / DAY; return d < 1 / 24 ? `${Math.max(1, Math.round(d * 1440))}m` : d < 1 ? `${Math.round(d * 24)}h` : d < 14 ? `${Math.round(d)}d` : d < 60 ? `${Math.round(d / 7)}w` : `${Math.round(d / 30)}mo`; };
const longAgo = (iso) => { const s = since(iso); return s ? s.replace(/m$/, " minutes").replace(/h$/, " hours").replace(/d$/, " days").replace(/w$/, " weeks").replace(/mo$/, " months") + " ago" : ""; };
const IC = { eye: xi("eye"), thumbs: xi("thumbs-up"), back: xi("send-back"), conflict: xi("git-compare"), draft: xi("edit"), open: xi("state-idle"), closed: xi("check-circle"), pr: xi("pull-request"), merged: xi("merge"), ok: xi("check"), fail: xi("x-circle"), run: xi("spinner"), comment: xi("comment"), ext: xi("external-link"), sync: xi("sync"), branch: xi("branch"), thread: xi("thread") };

const SAMPLE = {
  prs: (repo) => [
    { number: 291, title: "Projects chat: relay coordinator notes into the thread they name", state: "open", author: "dwivedi-ai", head: "xo/thread-7c1f02", base: "main", updated_at: ago(0.2), checks: "fail", failing: "tests (3.12)", review: "changes", comments: 4, add: 214, del: 38, files: 7, mergeable: "conflicting", thread: "Relay notes into threads", url: `https://github.com/${repo}/pull/291` },
    { number: 289, title: "Storm: enforce deny rules in auto mode", state: "open", author: "sharmasuraj0123", head: "storm-deny-auto", base: "main", updated_at: ago(1.1), checks: "ok", review: "requested", comments: 2, add: 61, del: 9, files: 3, mergeable: "clean", url: `https://github.com/${repo}/pull/289` },
    { number: 288, title: "Session status resets after a server restart", state: "open", author: "dwivedi-ai", head: "xo/thread-a41be0", base: "main", updated_at: ago(2.4), checks: "run", review: null, draft: true, comments: 0, add: 1240, del: 512, files: 18, mergeable: "clean", thread: "Session status after restart", url: `https://github.com/${repo}/pull/288` },
    { number: 284, title: "Doctor: report the GitHub poller's budget", state: "merged", author: "sharmasuraj0123", head: "doctor-gh-budget", base: "main", updated_at: ago(6), checks: "ok", review: "approved", comments: 1, add: 88, del: 4, files: 2, mergeable: "clean", url: `https://github.com/${repo}/pull/284` },
    { number: 281, title: "Inbox: one feeder per source", state: "closed", author: "dwivedi-ai", head: "inbox-feeders", base: "main", updated_at: ago(9), checks: "ok", review: null, comments: 3, add: 12, del: 140, files: 5, mergeable: "clean", url: `https://github.com/${repo}/pull/281` },
  ],
  body: "When the coordinator relays a note to an existing thread, the note never shows in that thread's timeline. The thread does receive it (its next turn acts on it) but the owner can't see what it was told.\n\n**To reproduce**\n1. Start a thread from the project chat.\n2. Ask the coordinator to pass it a note.\n3. Open the thread: the note isn't there.\n\nExpected: the relay shows as a quoted note from the coordinator, like a spawn brief.",
  comments: [
    { author: "sharmasuraj0123", at: ago(3), text: "Confirmed on 0.14. The relay is written to the session, not to the thread's message log." },
    { author: "dwivedi-ai", at: ago(1), text: "The panel's Thread page will need the same fix: it reads the same log." },
  ],
};
const PEOPLE = ["sharmasuraj0123", "dwivedi-ai"];
const avatar = (login, cls = "gh-av") => `<img class="${cls}" src="https://github.com/${encodeURIComponent(login)}.png?size=48" alt="" loading="lazy" width="16" height="16" title="${esc(login)}">`;
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const size = (a, d) => `<span class="gh-sz"><span class="gh-add">+${num(a)}</span><span class="gh-del">−${num(d)}</span></span>`;
const icon = (svg, cls, tip) => `<span class="gh-i ${cls}" title="${esc(tip)}" aria-label="${esc(tip)}">${svg}</span>`;
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
    `<span class="ag-tm"><span class="ag-when">${esc(since(r.at))}</span>${r.right ? `<span class="ag-mk">${r.right}</span>` : ""}</span></button></li>`;
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
        sub: `#${i.number}`, subHtml: `${avatar(i.author || PEOPLE[n % 2])}#${i.number}${(i.comments ?? (n * 7) % 5) ? `<span class="gh-i gh-cm" title="Comments">${IC.comment}${i.comments ?? (n * 7) % 5}</span>` : ""}` };
    });
    return [group("worked", "In a thread", list.filter((r) => r.worked)), group("open", "Open", list.filter((r) => !r.worked && r.state === "open")), group("closed", "Closed", list.filter((r) => r.state !== "open"), 5)].join("");
  }
  const CHECK = { ok: [IC.ok, "is-ok", "Checks pass"], fail: [IC.fail, "is-err", "Checks failing"], run: [IC.run, "is-run", "Checks running"] };
  const REVIEW = { requested: "Your review is asked", changes: "Changes asked", approved: "Approved" };
  const REVIEW_IC = { requested: [IC.eye, "is-warn"], changes: [IC.back, "is-err"], approved: [IC.thumbs, "is-ok"] };
  function prRows(d) {
    const list = d.prs.map((p) => {
      const c = CHECK[p.checks], needs = p.state === "open" && (p.review === "requested" || p.checks === "fail");
      return { key: `p${p.number}`, title: p.title, at: p.updated_at, state: p.state, needs, tone: p.state === "merged" ? "merged" : p.state === "open" ? (p.draft ? "draft" : "open") : "done", idle: p.state !== "open",
        icon: p.state === "merged" ? IC.merged : IC.pr, mark: p.thread && p.state === "open" ? ARC : needs ? `<i class="ag-wait ag-need">${ICON.diamond}</i>` : "",
        sub: `#${p.number}`, right: size(p.add, p.del), subHtml: `${avatar(p.author)}#${p.number}${p.state === "open" ? (c ? icon(c[0], c[1], c[2]) : "") + (p.review ? icon(REVIEW_IC[p.review][0], REVIEW_IC[p.review][1], REVIEW[p.review]) : "") + (p.mergeable === "conflicting" ? icon(IC.conflict, "is-err", `Conflicts with ${p.base}`) : "") + (p.draft ? icon(IC.draft, "", "Draft") : "") : ""}${p.comments ? `<span class="gh-i gh-cm" title="Comments">${IC.comment}${p.comments}</span>` : ""}` };
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
    const tab = (k, word, n) => `<button type="button" class="fr-t${G.tab === k ? " is-on" : ""}" role="tab" aria-selected="${G.tab === k}" data-gh-tab="${k}">${k === "prs" ? IC.pr : IC.open}${word}<span class="fr-n">${n || ""}</span></button>`;
    return `<header class="fr-h gh-h"><div class="fr-tabs" role="tablist" aria-label="Issues or pull requests">${tab("issues", "Issues", nOpen)}${tab("prs", "Pull requests", nPr)}</div>` +
      `<div class="fr-a"><a class="fr-ib" href="https://github.com/${esc(d.issues.repo)}/${G.tab === "prs" ? "pulls" : "issues"}" target="_blank" rel="noopener" title="Open on GitHub" aria-label="Open on GitHub">${IC.ext}</a><button type="button" class="fr-ib" data-gh-refresh title="Read GitHub again" aria-label="Read GitHub again">${IC.sync}</button></div></header>` +
      notice(d) + `<div class="fr-b gh-b"><ul class="ag-list tg-list">${G.tab === "issues" ? issueRows(d) : prRows(d)}</ul></div>`;
  }

  function itemHtml(d, key) {
    const n = Number(key.slice(1)), isPr = key[0] === "p";
    const list = d.issues.issues || [];
    const it = isPr ? d.prs.find((p) => p.number === n) : list.find((i) => i.number === n);
    if (!it) return `<p class="fr-none">Not found.</p>`;
    const state = it.state, word = state === "merged" ? "Merged" : state === "open" ? (it.draft ? "Draft" : "Open") : "Closed";
    const badge = `<span class="badge gh-st is-${state === "open" ? "open" : state}">${state === "merged" ? IC.merged : isPr ? IC.pr : state === "open" ? IC.open : IC.closed}${word}</span>`;
    const by = it.author || PEOPLE[list.indexOf(it) % 2];
    const worked = isPr ? !!it.thread : list.indexOf(it) === 0 && it.state === "open";
    const fact = (svg, cls, main, sub, right = "") => `<li><span class="ch-r gh-ckr"><span class="ch-i gh-i ${cls}">${svg}</span><span class="ch-copy"><span class="ch-n">${main}</span>${sub ? `<span class="ch-path">${sub}</span>` : ""}</span>${right ? `<span class="ch-m">${right}</span>` : ""}</span></li>`;
    const c = CHECK[it.checks];
    const prFacts = isPr && state === "open" ? `<section class="gh-sec"><ul class="ch-list">` +
      (it.mergeable === "conflicting" ? fact(IC.conflict, "is-err", `Conflicts with <code>${esc(it.base)}</code>`, "2 files: js/stage.js, css/panel.css") : fact(IC.ok, "is-ok", `Merges cleanly into <code>${esc(it.base)}</code>`, "")) +
      fact(c[0], c[1], c[2], it.checks === "fail" ? `${esc(it.failing)} failed · 2 passed` : it.checks === "run" ? "1 of 3 still running" : "3 passed") +
      (it.review ? fact(REVIEW_IC[it.review][0], REVIEW_IC[it.review][1], esc(REVIEW[it.review]), it.review === "changes" ? `${avatar("sharmasuraj0123", "gh-av is-in")}sharmasuraj0123` : "") : "") +
      `</ul></section>` : "";
    const changes = isPr ? `<section class="gh-sec"><h3 class="gh-k">Changes</h3><ul class="ch-list"><li><button type="button" class="ch-r"><span class="ch-i">${ICON.changes}</span><span class="ch-copy"><span class="ch-n">${it.files} files</span><span class="ch-path">${esc(it.head)} → ${esc(it.base)}</span></span><span class="ch-m">${size(it.add, it.del)}</span></button></li></ul><div class="gh-bar" role="img" aria-label="${it.add} lines added, ${it.del} removed"><i class="gh-add" style="flex:${it.add}"></i><i class="gh-del" style="flex:${it.del}"></i></div></section>` : "";
    const act = worked
      ? `<button type="button" class="btn btn-pri" data-gh-thread>${IC.thread}Open its thread</button>`
      : `<button type="button" class="btn btn-pri" data-gh-work>${IC.thread}${isPr ? "Review it in a thread" : "Work on it in a thread"}</button>`;
    const ncm = isPr ? it.comments : SAMPLE.comments.length;
    return `<div class="gh-dh"><h2 class="gh-title">${esc(it.title)} <span class="gh-num">#${n}</span></h2>` +
      `<p class="gh-meta">${badge}<span class="gh-by">${avatar(by)}${esc(by)}</span>${dot}<span>${esc(longAgo(it.updated_at))}</span>${ncm ? `${dot}<span class="gh-i gh-cm">${IC.comment}${ncm}</span>` : ""}</p>` +
      `<div class="gh-acts">${act}<a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener">${IC.ext}Open on GitHub</a></div></div>` +
      prFacts + changes +
      `<section class="gh-sec"><div class="prose gh-body">${renderMarkdown(SAMPLE.body)}</div></section>` +
      `<section class="gh-sec"><h3 class="gh-k">Comments</h3><ol class="gh-cms">${SAMPLE.comments.map((x) => `<li class="gh-c">${avatar(x.author, "gh-av is-lg")}<div class="gh-cb"><p class="gh-ch"><b>${esc(x.author)}</b>${dot}<span>${esc(longAgo(x.at))}</span></p><div class="prose">${renderMarkdown(x.text)}</div></div></li>`).join("")}</ol></section>`;
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
