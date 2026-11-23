// @ts-check

// GitHub, a page of the panel: a project's issues and pull requests from Space's mirror, and one item over it.
import { ICON } from "../../core/ui/icons/names.js";
import { ARC, xi } from "../../core/ui/icons/icon.js";
import { esc } from "../../core/platform/util.js";
import { renderMarkdown } from "../../core/ui/markdown/markdown.js";

/** @typedef {import('./types').PageData} PageData @typedef {import('./types').Detail} Detail @typedef {import('./types').Person} Person @typedef {import('./types').Issue} Issue @typedef {import('./types').Pull} Pull */
const DAY = 86400000;
/** @param {string | null} [iso] */
export function since(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const d = Math.max(0, now - t) / DAY;
  return d < 1 / 24 ? `${Math.max(1, Math.round(d * 1440))}m` : d < 1 ? `${Math.round(d * 24)}h` : d < 14 ? `${Math.round(d)}d` : d < 60 ? `${Math.round(d / 7)}w` : `${Math.round(d / 30)}mo`;
}
/** @type {Record<string, string>} */
const WORDS = { m: "minute", h: "hour", d: "day", w: "week", mo: "month" };
/** @param {string | null} [iso] */
export function longAgo(iso, now = Date.now()) {
  const m = /^(\d+)(mo|m|h|d|w)$/.exec(since(iso, now));
  return m ? `${m[1]} ${WORDS[m[2]]}${m[1] === "1" ? "" : "s"} ago` : "";
}
const IC = { open: xi("state-idle"), closed: xi("check-circle"), pr: xi("pull-request"), merged: xi("merge"), ok: xi("check"), fail: xi("x-circle"), run: xi("spinner"),
  comment: xi("comment"), ext: xi("external-link"), sync: xi("sync"), thread: xi("thread"), eye: xi("eye"), thumbs: xi("thumbs-up"), back: xi("send-back"), conflict: xi("git-compare"), draft: xi("edit") };

/** @param {number} n */
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
/** @param {number} a @param {number} d */
const size = (a, d) => `<span class="gh-sz"><span class="gh-add">+${num(a)}</span><span class="gh-del">−${num(d)}</span></span>`;
/** @param {string} svg @param {string} cls @param {string} tip */
const icon = (svg, cls, tip) => `<span class="gh-i ${cls}" title="${esc(tip)}" role="img" aria-label="${esc(tip)}">${svg}</span>`;
/** @param {ReturnType<typeof person>} who */
const avatar = (who, cls = "gh-av") => (who && who.avatar ? `<img class="${cls}" src="${esc(who.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" title="${esc(who.login)}">` : "");
const dot = `<span class="gh-sep" aria-hidden="true">·</span>`;
/** @param {unknown} v */
const up = (v) => String(v || "").toUpperCase();
/** @param {number | { total_count?: number } | null} [v] @returns {number | null} */
const count = (v) => (Number.isInteger(v) ? /** @type {number} */ (v) : Number.isInteger((/** @type {{ total_count?: number }} */ (v))?.total_count) ? /** @type {{ total_count: number }} */ (v).total_count : null);

/** A person as Space may send one: {login, avatar_url} or a bare login. @param {Person} [v] */
function person(v) {
  if (!v) return null;
  if (typeof v === "string") return { login: v, avatar: null };
  return v.login ? { login: String(v.login), avatar: typeof (v.avatar_url || v.avatarUrl) === "string" ? v.avatar_url || v.avatarUrl : null } : null;
}
/** One mirror issue, in the page's words. @param {Issue} i */
export function issueOf(i) {
  return { kind: "issue", number: i.number, title: i.title || "", state: i.state === "closed" ? "closed" : "open", url: i.url || "", at: i.updated_at || null,
    author: person(i.author) || person((i.assignees || [])[0]), comments: count(i.comments ?? i.comment_count), worked: !!i.in_progress, labels: Array.isArray(i.labels) ? i.labels : [] };
}
/** @type {Record<string, keyof typeof CHECK | undefined>} */
const CHECKS = { SUCCESS: "ok", FAILURE: "fail", ERROR: "fail", PENDING: "run", EXPECTED: "run", IN_PROGRESS: "run", QUEUED: "run" };
/** @type {Record<string, keyof typeof REVIEW | undefined>} */
const REVIEWS = { REVIEW_REQUIRED: "requested", CHANGES_REQUESTED: "changes", APPROVED: "approved" };
/** One pull request, whichever spelling Space settles on (snake_case or GitHub's own). @param {Pull} p */
export function prOf(p) {
  const st = up(p.state);
  return { kind: "pr", number: p.number, title: p.title || "", url: p.url || "", at: p.updated_at || p.updatedAt || null,
    state: st === "MERGED" || p.merged ? "merged" : st === "CLOSED" ? "closed" : "open", draft: !!(p.is_draft ?? p.isDraft ?? p.draft),
    author: person(p.author), head: p.head || p.head_ref || p.headRefName || "", base: p.base || p.base_ref || p.baseRefName || "",
    checks: CHECKS[up(p.checks ?? p.check_state ?? p.statusCheckRollup)] || null, review: REVIEWS[up(p.review_decision ?? p.reviewDecision)] || null,
    conflict: up(p.mergeable) === "CONFLICTING", add: count(p.additions), del: count(p.deletions), files: count(p.changed_files ?? p.changedFiles),
    comments: count(p.comments ?? p.comment_count), worked: !!p.in_progress };
}
/** @type {Record<'ok' | 'fail' | 'run', [string, string, string]>} */
const CHECK = { ok: [IC.ok, "is-ok", "Checks pass"], fail: [IC.fail, "is-err", "Checks failing"], run: [IC.run, "is-run", "Checks running"] };
/** @type {Record<'requested' | 'changes' | 'approved', [string, string, string]>} */
const REVIEW = { requested: [IC.eye, "is-warn", "Review asked"], changes: [IC.back, "is-err", "Changes asked"], approved: [IC.thumbs, "is-ok", "Approved"] };
/** @param {ReturnType<typeof prOf>} p */
const needsYou = (p) => p.state === "open" && !p.draft && (p.checks === "fail" || p.review === "requested" || p.conflict);

/** @param {ReturnType<typeof issueRow> & { right?: string }} r */
const rowHtml = (r) => `<li><button type="button" class="ag-r${r.idle ? " is-idle" : ""}" data-gh-open="${esc(r.key)}" aria-label="${esc(`${r.title}. ${r.label}`)}">` +
  `<span class="ag-ic gh-ic is-${r.tone}" aria-hidden="true">${r.icon}${r.mark || ""}</span>` +
  `<span class="ag-t"><b>${esc(r.title)}</b><span class="ag-activity"><span class="ag-doing">${r.sub}</span></span></span>` +
  `<span class="ag-tm"><span class="ag-when">${esc(since(r.at))}</span>${r.right ? `<span class="ag-mk">${r.right}</span>` : ""}</span></button></li>`;
/** @param {number | null} n */
const comments = (n) => (n ? `<span class="gh-i gh-cm" title="${n} comment${n === 1 ? "" : "s"}">${IC.comment}${n}</span>` : "");

/** @param {ReturnType<typeof issueOf>} i */
export function issueRow(i) {
  const open = i.state === "open";
  return { key: `i${i.number}`, title: i.title, at: i.at, tone: open ? "open" : "done", idle: !open, icon: open ? IC.open : IC.closed, mark: i.worked && open ? ARC : "",
    label: `#${i.number}, ${open ? "open" : "closed"}`, sub: `${avatar(i.author)}#${i.number}${comments(i.comments)}` };
}
/** @param {ReturnType<typeof prOf>} p */
export function prRow(p) {
  const open = p.state === "open", c = CHECK[/** @type {keyof typeof CHECK} */ (p.checks)], r = REVIEW[/** @type {keyof typeof REVIEW} */ (p.review)];
  const marks = open ? (c ? icon(...c) : "") + (r ? icon(...r) : "") + (p.conflict ? icon(IC.conflict, "is-err", `Conflicts with ${p.base || "its base"}`) : "") + (p.draft ? icon(IC.draft, "", "Draft") : "") : "";
  return { key: `p${p.number}`, title: p.title, at: p.at, tone: p.state === "merged" ? "merged" : open ? (p.draft ? "draft" : "open") : "done", idle: !open,
    icon: p.state === "merged" ? IC.merged : IC.pr, mark: open && p.worked ? ARC : needsYou(p) ? `<i class="ag-wait ag-need">${ICON.diamond}</i>` : "",
    label: `#${p.number}, ${p.state === "merged" ? "merged" : open ? (p.draft ? "draft" : "open") : "closed"}`,
    sub: `${avatar(p.author)}#${p.number}${marks}${comments(p.comments)}`, right: p.add != null && p.del != null ? size(p.add, p.del) : "" };
}

/** @param {{ stage: import('./types').Stage, api: Pick<typeof import('../../core/platform/api.js').api, 'githubIssues' | 'githubPulls' | 'githubIssue' | 'githubPull' | 'githubStatus'>, view: () => string, projectOf: (view: string) => string, work?: (project: string, item: ReturnType<typeof issueOf> | ReturnType<typeof prOf>) => void, announce?: (message: string) => void }} deps */
export function createGhPage({ stage, api, view, projectOf, work = () => {}, announce = () => {} }) {
  /** @type {{ tab: string, data: Map<string, PageData>, folds: Record<string, boolean>, item: string | null, detail: Map<string, Detail>, noDetail: boolean, busy: boolean, more?: string }} */
  const G = { tab: "issues", data: new Map(), folds: { closed: true, pdone: true }, item: null, detail: new Map(), noDetail: false, busy: false };
  const pane = document.createElement("section");
  pane.className = "gh";
  pane.setAttribute("aria-label", "Issues and pull requests");
  const detail = document.createElement("section");
  detail.className = "gh gh-d";
  const project = () => projectOf(view());

  /** @type {Map<string, Promise<PageData>>} */
  const pending = new Map();
  /** @param {string} p @param {{ refresh?: boolean, again?: boolean }} [o] */
  function load(p, o = {}) {
    if (!p) return Promise.resolve(null);
    const had = G.data.get(p);
    if (had && !o.refresh && !o.again) return Promise.resolve(had);
    if (pending.has(p) && !o.refresh) return /** @type {Promise<PageData>} */ (pending.get(p));
    const run = read(p, o).finally(() => { if (pending.get(p) === run) pending.delete(p); });
    pending.set(p, run);
    return run;
  }
  /** @param {string} p @param {{ refresh?: boolean }} [options] @returns {Promise<PageData>} */
  async function read(p, { refresh = false } = {}) {
    const had = G.data.get(p);
    let issues, pulls = had ? had.pulls : undefined, status = null;
    try { issues = await api.githubIssues(p, refresh); } catch (e) { issues = { repo: had?.issues?.repo || null, state: "error", issues: [], error: { message: (/** @type {Error} */ (e))?.message || "Space didn't answer." } }; }
    // Space serves pull requests once it mirrors them: until then (404) the tab stays away
    if (issues.repo && pulls !== null) { try { pulls = await api.githubPulls(p); } catch (e) { pulls = (/** @type {import('../../core/platform/http.js').ApiError} */ (e))?.status === 404 ? null : had?.pulls; } }
    try { status = await api.githubStatus(); } catch { status = had?.status || null; }
    const d = { issues, status, pulls: pulls || null };
    G.data.set(p, d);
    return d;
  }
  /** @param {string} p */
  const repoOf = (p) => G.data.get(p)?.issues?.repo || null;
  /** @param {PageData} d */
  const issuesOf = (d) => (d.issues.issues || []).map(issueOf);
  /** @param {PageData} d */
  const prsOf = (d) => (d.pulls && Array.isArray(d.pulls.pulls) ? d.pulls.pulls.map(prOf) : null);

  /** @param {string} k @param {string} word @param {Parameters<typeof rowHtml>[0][]} rows */
  const group = (k, word, rows, cap = Infinity) => {
    if (!rows.length) return "";
    const folded = !!G.folds[k];
    const head = `<li class="tg-h"><button type="button" class="tg-b" data-gh-fold="${k}" aria-expanded="${!folded}"><span class="tg-w">${esc(word)}</span><span class="fr-n">${rows.length}</span><span class="tg-ch" aria-hidden="true">${ICON.chevron}</span></button></li>`;
    return head + (folded ? "" : rows.slice(0, cap).map(rowHtml).join("") + (rows.length > cap ? `<li class="tg-h"><a class="tg-b tg-more" href="${esc(G.more || "#")}" target="_blank" rel="noopener"><span class="tg-w">${rows.length - cap} more on GitHub</span></a></li>` : ""));
  };
  /** @param {PageData} d */
  function issuesHtml(d) {
    const all = issuesOf(d), st = d.issues.state;
    if (!all.length) return `<p class="fr-none">${st === "issues_disabled" ? "Issues are turned off for this repository." : st === "never_polled" ? "Reading GitHub…" : st === "error" ? "Nothing read from GitHub yet." : "No issues."}</p>`;
    const rows = all.map((i) => ({ i, r: issueRow(i) }));
    return `<ul class="ag-list tg-list">${[group("worked", "In a thread", rows.filter((x) => x.i.worked && x.i.state === "open").map((x) => x.r)),
      group("open", "Open", rows.filter((x) => !x.i.worked && x.i.state === "open").map((x) => x.r)),
      group("closed", "Closed", rows.filter((x) => x.i.state !== "open").map((x) => x.r), 5)].join("")}</ul>`;
  }
  /** @param {ReturnType<typeof prOf>[]} prs */
  function prsHtml(prs) {
    if (!prs.length) return `<p class="fr-none">No pull requests.</p>`;
    const rows = prs.map((p) => ({ p, r: prRow(p) }));
    return `<ul class="ag-list tg-list">${[group("needs", "Needs you", rows.filter((x) => needsYou(x.p) && !x.p.worked).map((x) => x.r)),
      group("popen", "Open", rows.filter((x) => x.p.state === "open" && (x.p.worked || !needsYou(x.p))).map((x) => x.r)),
      group("pdone", "Merged and closed", rows.filter((x) => x.p.state !== "open").map((x) => x.r), 5)].join("")}</ul>`;
  }
  /** @param {PageData} d */
  function notice(d) {
    const st = d.status, signedOut = st && st.valid === false, err = /** @type {{ message?: string }} */ (d.issues.error), when = longAgo(d.issues.fetched_at);
    if (!signedOut && !err) return "";
    const what = signedOut ? "GitHub isn't signed in." : `GitHub didn't answer${err.message ? `: ${err.message}` : "."}`;
    const since = when ? ` This is what it said ${when}.` : "";
    return `<div class="gh-note" role="status">${ICON.warn}<span>${esc(what + since)}</span>${signedOut ? `<button type="button" class="btn" data-set-open="accounts">Sign in</button>` : ""}</div>`;
  }
  /** @param {PageData} [d] */
  function listHtml(d) {
    if (!d) return `<p class="fr-none">Reading GitHub…</p>`;
    const repo = d.issues.repo;
    if (!repo) return `<p class="fr-none">${d.issues.state === "error" ? "Space didn't answer. Try again in a moment." : "This project has no GitHub remote."}</p>`;
    const prs = prsOf(d);
    if (!prs && G.tab === "prs") G.tab = "issues";
    G.more = `https://github.com/${repo}/${G.tab === "prs" ? "pulls?q=is%3Apr+is%3Aclosed" : "issues?q=is%3Aissue+is%3Aclosed"}`;
    const nIssues = issuesOf(d).filter((i) => i.state === "open").length;
    /** @param {string} k @param {string} glyph @param {string} word @param {number} n */
    const tab = (k, glyph, word, n) => `<button type="button" class="fr-t${G.tab === k ? " is-on" : ""}" role="tab" aria-selected="${G.tab === k}" data-gh-tab="${k}">${glyph}${word}<span class="fr-n">${n || ""}</span></button>`;
    const tabs = prs ? `<div class="fr-views" role="tablist" aria-label="Issues or pull requests">${tab("issues", IC.open, "Issues", nIssues)}${tab("prs", IC.pr, "Pull requests", prs.filter((p) => p.state === "open").length)}</div>`
      : `<h2 class="fr-title">${IC.open}Issues<span class="fr-n">${nIssues || ""}</span></h2>`;
    return `<header class="fr-h gh-h">${tabs}<div class="fr-a"><a class="fr-ib" href="https://github.com/${esc(repo)}/${G.tab === "prs" ? "pulls" : "issues"}" target="_blank" rel="noopener" title="Open on GitHub" aria-label="Open on GitHub">${IC.ext}</a>` +
      `<button type="button" class="fr-ib" data-gh-refresh title="Read GitHub again" aria-label="Read GitHub again"${G.busy ? ' aria-busy="true"' : ""}>${IC.sync}</button></div></header>` +
      notice(d) + `<div class="fr-b gh-b">${G.tab === "prs" && prs ? prsHtml(prs) : issuesHtml(d)}</div>`;
  }

  /** @param {string} svg @param {string} cls @param {string} main */
  const fact = (svg, cls, main, sub = "") => `<li><span class="ch-r gh-ckr"><span class="ch-i gh-i ${cls}">${svg}</span><span class="ch-copy"><span class="ch-n">${main}</span>${sub ? `<span class="ch-path">${sub}</span>` : ""}</span></span></li>`;
  /** @param {PageData} d @param {string} key */
  function itemHtml(d, key) {
    const n = Number(key.slice(1)), isPr = key[0] === "p";
    const it = /** @type {(ReturnType<typeof issueOf> & Partial<ReturnType<typeof prOf>>) | undefined} */ (isPr ? (prsOf(d) || []).find((p) => p.number === n) : issuesOf(d).find((i) => i.number === n));
    if (!it) return `<p class="fr-none">GitHub no longer lists ${isPr ? "pull request" : "issue"} #${n} here.</p>`;
    const more = G.detail.get(`${project()}|${key}`) || null;
    const st = it.state, word = st === "merged" ? "Merged" : st === "open" ? (it.draft ? "Draft" : "Open") : "Closed";
    const badge = `<span class="badge gh-st is-${st}">${st === "merged" ? IC.merged : isPr ? IC.pr : st === "open" ? IC.open : IC.closed}${word}</span>`;
    const by = it.author ? `${dot}<span class="gh-by">${avatar(it.author)}${esc(it.author.login)}</span>` : "";
    const when = it.at ? `${dot}<span>${esc(longAgo(it.at))}</span>` : "";
    const cm = it.comments ? `${dot}<span class="gh-i gh-cm">${IC.comment}${it.comments}</span>` : "";
    const act = st !== "open" || it.worked ? "" : `<button type="button" class="btn btn-pri" data-gh-work>${IC.thread}${isPr ? "Review it in a thread" : "Work on it in a thread"}</button>`;
    const facts = [];
    if (it.worked && st === "open") facts.push(fact(IC.thread, "is-info", "A thread is working on it"));
    if (isPr && st === "open") {
      const files = Array.isArray(more?.conflicts) ? more.conflicts : [];
      if (it.conflict) facts.push(fact(IC.conflict, "is-err", `Conflicts with <code>${esc(it.base)}</code>`, files.length ? esc(`${files.length} file${files.length === 1 ? "" : "s"}: ${files.join(", ")}`) : ""));
      else if (it.base) facts.push(fact(IC.ok, "is-ok", `Merges cleanly into <code>${esc(it.base)}</code>`));
      if (it.checks) { const runs = Array.isArray(more?.checks) ? more.checks : [], bad = runs.filter((r) => CHECKS[up(r.state || r.conclusion)] === "fail").map((r) => r.name); facts.push(fact(CHECK[it.checks][0], CHECK[it.checks][1], CHECK[it.checks][2], bad.length ? esc(`${bad.join(", ")} failed`) : "")); }
      if (it.review) facts.push(fact(REVIEW[it.review][0], REVIEW[it.review][1], REVIEW[it.review][2]));
    }
    const status = facts.length ? `<section class="gh-sec"><h3 class="gh-k">Status</h3><ul class="ch-list">${facts.join("")}</ul></section>` : "";
    const changes = isPr && it.add != null && it.del != null ? `<section class="gh-sec"><h3 class="gh-k">Changes</h3><ul class="ch-list"><li><a class="ch-r" href="${esc(it.url)}/files" target="_blank" rel="noopener"><span class="ch-i">${ICON.changes}</span><span class="ch-copy"><span class="ch-n">${it.files != null ? `${it.files} file${it.files === 1 ? "" : "s"}` : "Files"}</span>${it.head ? `<span class="ch-path">${esc(it.head)} → ${esc(it.base)}</span>` : ""}</span><span class="ch-m">${size(it.add, it.del)}</span></a></li></ul>` +
      (it.add + it.del ? `<div class="gh-bar" role="img" aria-label="${it.add} lines added, ${it.del} removed"><i class="gh-add" style="flex:${it.add}"></i><i class="gh-del" style="flex:${it.del}"></i></div>` : "") + `</section>` : "";
    const body = more && more.body ? `<section class="gh-sec"><div class="prose gh-body">${renderMarkdown(more.body)}</div></section>` : "";
    const list = more && Array.isArray(more.comments) && more.comments.length ? `<section class="gh-sec"><h3 class="gh-k">Comments</h3><ol class="gh-cms">${more.comments.map((c) => { const who = person(c.author); return `<li class="gh-c">${avatar(who, "gh-av is-lg") || '<span class="gh-av is-lg" aria-hidden="true"></span>'}<div><p class="gh-ch"><b>${esc(who?.login || "someone")}</b>${c.created_at ? `${dot}<span>${esc(longAgo(c.created_at))}</span>` : ""}</p><div class="prose">${renderMarkdown(c.body || "")}</div></div></li>`; }).join("")}</ol></section>` : "";
    return `<div class="gh-dh"><h2 class="gh-title">${esc(it.title)} <span class="gh-num">#${n}</span></h2><p class="gh-meta">${badge}${by}${when}${cm}</p>` +
      `<div class="gh-acts">${act}<a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener">${IC.ext}Open on GitHub</a></div></div>` + status + changes + body + list;
  }

  function paint() { pane.innerHTML = listHtml(G.data.get(project())); }
  function paintItem() { const d = G.data.get(project()); detail.innerHTML = `<div class="fr-b gh-b gh-db">${d && G.item ? itemHtml(d, G.item) : ""}</div>`; }
  /** @param {string} p @param {string} key */
  async function more(p, key) {
    const k = `${p}|${key}`;
    if (G.noDetail || G.detail.has(k)) return;
    try { G.detail.set(k, await (key[0] === "p" ? api.githubPull(p, Number(key.slice(1))) : api.githubIssue(p, Number(key.slice(1))))); }
    catch (e) { if ((/** @type {import('../../core/platform/http.js').ApiError} */ (e))?.status === 404 || (/** @type {import('../../core/platform/http.js').ApiError} */ (e))?.status === 405) G.noDetail = true; return; }
    if (G.item === key && project() === p) paintItem();
  }

  pane.addEventListener("click", async (e) => {
    const t = /** @type {HTMLButtonElement | null} */ ((/** @type {Element} */ (e.target)).closest("button"));
    if (!t) return;
    if (t.dataset.ghTab) { G.tab = t.dataset.ghTab; paint(); return; }
    if (t.dataset.ghFold) { G.folds[t.dataset.ghFold] = !G.folds[t.dataset.ghFold]; paint(); return; }
    if (t.hasAttribute("data-gh-refresh")) {
      if (G.busy) return;
      G.busy = true; paint();
      const p = project();
      await load(p, { refresh: true });
      G.busy = false; G.detail.clear();
      if (project() === p) { paint(); announce("Read GitHub again."); }
      return;
    }
    if (t.dataset.ghOpen) { G.item = t.dataset.ghOpen; stage.show("ghitem", G.item, { focus: true }); }
  });
  detail.addEventListener("click", (e) => {
    if (!(/** @type {Element} */ (e.target)).closest("[data-gh-work]") || !G.item) return;
    const d = /** @type {PageData} */ (G.data.get(project())), n = Number(G.item.slice(1));
    const it = G.item[0] === "p" ? (prsOf(d) || []).find((p) => p.number === n) : issuesOf(d).find((i) => i.number === n);
    if (it) work(project(), it);
  });

  stage.page("github", {
    title: () => repoOf(project()) || "GitHub",
    mount: (host) => host.append(pane),
    onShow: async () => { paint(); const p = project(); await load(p, { again: true }); if (project() === p) paint(); },
  });
  stage.page("ghitem", {
    over: true,
    title: (key) => `${key[0] === "p" ? "Pull request" : "Issue"} #${key.slice(1)}`,
    backTo: () => repoOf(project()) || "GitHub",
    mount: (host) => host.append(detail),
    onShow: (key) => { G.item = key; paintItem(); more(project(), key); },
  });

  return {
    show: async () => { await load(project()); stage.show("github", "github", { focus: true }); },
    /** The panel's GitHub button shows only on a project with a GitHub remote. @param {string} p */
    async has(p) { const d = await load(p); return !!d?.issues?.repo; },
    get isOpen() { const n = stage.pageShown?.name; return n === "github" || n === "ghitem"; },
  };
}
