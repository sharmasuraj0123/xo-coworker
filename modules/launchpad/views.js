// @ts-check

// The section's screens: setup, a run, live, failed, needs, getting ready, GitHub's code, picking an app, checking.
import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/index.js";
import { appState, formKey, launchpadUrl } from "./model.js";
import { createSystem } from "./system.js";
import { LP_ICON, NODES, NEEDS_YOU, since, where, cap, sizeText, hero, span, lit, fixOf, actionHtml, ghCmd, cmdHtml, head, rec, repoFacts, appsFacts, sizeHint, field, warnHtml } from "./words.js";

/** Adds the screens to the section's shared state L. @param {any} L */
export function installViews(L) {
  const { S, proj, nameOf, findThread } = L;
  const system = createSystem(L);

  /** @param {string} p */
  function setupHtml(p) {
    const s = proj(p), c = s.check, f = s.form, e = f.errs || {};
    const scope = c.github && c.github.connected && c.github.workflow;
    const guessed = c.state === "detectable";
    const env = c.env || [];
    const from = [...new Set(env.map((/** @type {any} */ x) => x.source).filter(Boolean))].join(", ");
    const mine = env.filter((/** @type {any} */ x) => x.sensitive || !x.default || f.env[x.name] || s.envAll || (s.editing && c.app)), rest = env.length - mine.length;
    const nd = s.needs;
    const editing = !!(s.editing && c.app);
    return (editing ? head(`${esc(nameOf(p))}'s settings`, `Change what you need; ${c.behind ? `it deploys again with them, and with ${esc(c.repo.branch || "main")}'s commits since the live release` : "the live commit is built again with them"}. Values left empty stay as they are on Launchpad.`)
      : head(`Put ${esc(nameOf(p))} on the web`, guessed ? "Found these in the project. Check them, then deploy." : "Launchpad builds it on every push and runs it.")) +
      askedHtml(p) +
      (nd ? `<div class="lp-rec lp-ask"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}One thing first</span><b>${esc(nd.message || "")}</b>${nd.fix ? `<p>${esc(nd.fix)}</p>` : ""}${nd.code === "confirm_repo" ? repoFacts(nd) : nd.code === "other_apps" ? appsFacts(nd) : ""}</div>${lit(nd) ? `<button type="button" class="lp-go" data-lp="${lit(nd)[1]}"><span>${esc(lit(nd)[0])}</span></button>` : ""}${nd.code === "confirm_repo" ? `<div class="lp-alt"><button type="button" class="lp-a" data-lp="decline-repo"><span>Not this repository</span></button></div>` : nd.code === "other_apps" ? `<div class="lp-alt"><button type="button" class="lp-a" data-lp="decline-apps"><span>Don't push</span></button></div>` : ""}</div>` : "") +
      (c.blockers.length ? `<p class="lp-note t-need">Deploy would stop here: ${esc(c.blockers.join("; "))}.</p>` : "") +
      // what Space warned of before the button is pressed (a repository that isn't the person's own, uncommitted changes, …)
      (c.warnings.length ? c.warnings.map((/** @type {any} */ w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("") : "") +
      (editing ? "" : system(p, "preview")) +
      (c.github.source === "gh" && c.github.connected && !c.github.workflow && ghCmd(c.github.fix) ? `<div class="lp-gh"><p class="lp-note">Or grant it to this machine's gh login, then check again:</p>${cmdHtml(ghCmd(c.github.fix), s)}<div class="lp-alt lp-left"><button type="button" class="lp-a" data-lp="recheck-gh"${s.pre === 1 ? ' aria-disabled="true"' : ""}>${s.pre === 1 ? '<i class="lp-arc" aria-hidden="true"></i><span>Checking GitHub…</span>' : `${ICON.retry}<span>I ran it: check again</span>`}</button></div>${s.ghErr ? `<p class="lp-err lp-gh-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div>` : "") +
      (S.v && S.v.startsWith("t:") ? `<p class="lp-note lp-src" title="This thread's work goes out once it's merged into ${esc(c.repo.branch || "main")}">${ICON.branch}<span>Deploys <b>${esc(c.repo.branch || "main")}</b>, not this thread's branch.</span></p>` : "") +
      `<div class="lp-set">` +
      (editing ? "" : field("name", "Name", f.name, { hint: e.name || "It can't change later.", bad: !!e.name, fix: e.nameFix })) +
      field("port", "Port", f.port, { hint: e.port || (c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${esc(where(c.portFrom))}` : "Where the app listens"), bad: !!e.port, mode: "numeric", short: true }) +
      machineRows(s, c, f, e, editing) +
      // once a repository name had to be chosen, its field stays while you change it (a fixed error mustn't make it vanish)
      (e.repo || f.repoChosen ? field("repo", "Repository", f.repo, { hint: e.repo || hintFor("repo", p), bad: !!e.repo }) : "") +
      `</div>` +
      (env.length ? `<fieldset class="lp-env"><legend><span>Environment</span>${from ? `<small>from ${esc(from)}</small>` : ""}</legend>` +
        mine.map((/** @type {any} */ x) => `<label class="lp-f lp-ev"><span class="lp-l lp-mono" title="${esc(x.name)}">${esc(x.name)}</span><input class="lp-in" data-lp-env="${esc(x.name)}" type="${x.sensitive ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(editing && x.set ? "Set · leave to keep" : x.default || "Not set")}" aria-label="${esc(x.name)}"></label>`).join("") +
        (rest ? `<button type="button" class="lp-a lp-more" data-lp="env-all"><span>${rest} more with example values</span>${ICON.chevron || ""}</button>` : "") +
        `<p class="lp-lock">${ICON.lock}<span>Straight to Launchpad; XO never keeps them.</span></p></fieldset>` : "") +
      `<div class="lp-foot">` + (scope
        ? `<button type="button" class="lp-go lp-wide${nd && lit(nd) ? " is-quiet" : ""}" data-lp="deploy">${LP_ICON.rocket}<span>${editing ? "Deploy with these" : `Deploy ${esc(f.name || nameOf(p))}`}</span></button>`
        : `<button type="button" class="lp-go lp-wide" data-lp="reconnect">${LP_ICON.github}<span>${c.github.connected ? "Reconnect GitHub" : "Connect GitHub"}</span></button>`) +
      (editing ? `<div class="lp-alt"><button type="button" class="lp-a" data-lp="edit-cancel"><span>Cancel</span></button></div></div>`
        : `<div class="lp-alt"><button type="button" class="lp-a" data-lp="pick">${LP_ICON.link}<span>Link an app already on Launchpad</span></button></div></div>`);
  }
  /** The machine: a new app's size (what the template allows) and optional disk; a linked app's fixed size and its disk, which grows, never shrinks. @param {any} s @param {any} c @param {any} f @param {any} e @param {boolean} editing */
  function machineRows(s, c, f, e, editing) {
    /** @param {string} id */
    const ids = (id) => `aria-describedby="lp-h-${id}"${e[id] ? ' aria-invalid="true"' : ""}`;
    /** @param {string} label @param {string} inner */
    const row = (label, inner, bad = false, tag = "div") => `<${tag} class="lp-f${bad ? " is-bad" : ""}"><span class="lp-l">${label}</span>${inner}</${tag}>`;
    /** @param {string} id @param {any} text */
    const hint = (id, text) => `<span class="lp-hint" id="lp-h-${id}">${text}</span>`;
    if (editing) {
      const a = c.app;
      return (a.size || a.sizeLabel ? row("Size", `<span class="lp-v"><span class="lp-ro">${esc(sizeText(c, a.size, a.sizeLabel))}</span>${hint("size", "Fixed when it was created.")}</span>`) : "") +
        (a.storage === undefined ? "" : a.storage
          ? row("Disk", `<span class="lp-v"><span class="lp-pair"><input class="lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u lp-at">GB at <code>${esc(a.storage.path)}</code></span></span>${hint("disk", e.disk || "Grows, never shrinks.")}</span>`, !!e.disk, "label")
          : row("Disk", `<span class="lp-v"><span class="lp-ro">None</span>${hint("disk", "Can't be added after creation.")}</span>`));
    }
    // a Space that offers sizes (xo-space 3886701 on): folded to one line until you change it; an older one, nothing
    const z = c.sizes, at = f.size || z?.def || "";
    if (!z) return "";
    if (!(s.machine || e.size || e.disk)) {
      const t = z.tiers.find((/** @type {any} */ x) => x.name === at);
      return row("Machine", `<span class="lp-v is-row"><span class="lp-ro">${esc(t ? `${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB` : "Launchpad's default")}${f.disk ? ` · ${esc(f.diskGb)} GB disk` : ""}</span><button type="button" class="lp-a lp-chg" data-lp="machine-open" aria-label="Change the machine">Change</button></span>`);
    }
    // the app's one dropdown (<xo-select>), never the browser's <select>; its row is a div, so a click on the word Size doesn't open the list
    return (z ? row("Size", `<span class="lp-v"><xo-select class="lp-xs" data-lp-f="size" aria-label="Size" ${ids("size")}>${z.def ? "" : `<option value=""${at ? "" : " selected"}>Launchpad's default</option>`}` +
        z.tiers.map((/** @type {any} */ t) => `<option value="${esc(t.name)}"${at === t.name ? " selected" : ""}${t.name === z.def ? ' data-desc="Default"' : ""}>${esc(`${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB`)}</option>`).join("") +
        `</xo-select>${hint("size", e.size || sizeHint(c, f))}</span>`, !!e.size) : "") +
      (f.disk
        ? row("Disk", `<span class="lp-v"><span class="lp-pair"><input class="lp-in lp-mono" data-lp-f="diskPath" value="${esc(f.diskPath)}" placeholder="/data" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Where the disk is mounted" ${ids("disk")}><input class="lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u">GB</span><button type="button" class="lp-ib" data-lp="disk-remove" title="No disk" aria-label="No disk">${ICON.close}</button></span>${hint("disk", e.disk || "Grows later, never shrinks.")}</span>`, !!e.disk)
        : row("Disk", `<span class="lp-v is-row"><button type="button" class="lp-a lp-add" data-lp="disk-add">${ICON.plus}<span>Add a disk</span></button>${hint("disk", "Only at creation")}</span>`));
  }
  /** A field's hint while its value is valid (what setupHtml and machineRows show without an error). @param {string} k @param {string} p */
  function hintFor(k, p) {
    const s = proj(p), c = s.check, f = s.form, editing = !!(s.editing && c.app);
    if (k === "name") return "It can't change later.";
    if (k === "port") return c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${where(c.portFrom)}` : "Where the app listens";
    if (k === "size") return sizeHint(c, f);
    if (k === "disk") return editing ? "Grows, never shrinks." : "Grows later, never shrinks.";
    if (k === "repo") return "A new repository on your GitHub.";
    return "";
  }

  /** @param {string} p */
  function runHtml(p) {
    const s = proj(p), r = s.run, name = esc(s.form.name || nameOf(p));
    if (r.undo) return hero("Starting", `Deploying ${name} in <span class="lp-count" data-until="${r.undo}">${Math.max(1, Math.ceil((r.undo - Date.now()) / 1000))}</span> s.`, "work") + system(p, "run") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="undo">${ICON.rewind || ICON.retry}<span>Undo</span></button></div>`;
    const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo", rel = r.steps.release || {};
    const word = /** @type {Record<string, string>} */ ({ repo: "Pushing", build: "Building", release: `Rolling out${r.release ? ` #${r.release}` : ""}`, live: "Going live" })[on];
    const sentence = on === "release" && rel.of
      ? `${rel.ready} of ${rel.of} new instance${rel.of > 1 ? "s" : ""} ${rel.of > 1 ? "are" : "is"} ready.${s.check.app?.release ? ` Release #${s.check.app.release} keeps serving until the new one is healthy.` : ""}`
      : `${{ repo: `Pushing ${esc(s.check.repo.branch || "main")} to GitHub`, build: "GitHub Actions is building the image", release: "Launchpad is starting the new release", live: "Going live" }[on]} · ${since(r.startedAt)} in all`;
    // Stop's 3 s can still be taken back here (or in the notice); after that, only Space's receipt says it stopped
    const q = r.stopErr ? `<p class="lp-q t-need" role="status">Couldn't stop it: ${esc(r.stopErr)}. It's still deploying.</p>`
      : r.stopSent ? `<p class="lp-q" role="status">Stopping… it stops once Space confirms.</p>`
      : r.stopping ? `<p class="lp-q" role="status">Stops in <span class="lp-count" data-until="${r.stopAt}">${Math.max(1, Math.ceil((r.stopAt - Date.now()) / 1000))}</span> s.</p>`
      : `<p class="lp-q">Carries on if you close this.</p>`;
    const stop = r.stopSent ? `<button type="button" class="lp-b" data-lp="stop" aria-disabled="true"><i class="lp-arc" aria-hidden="true"></i><span>Stopping…</span></button>`
      : r.stopping ? `<button type="button" class="lp-b" data-lp="stop-undo"><span>Keep deploying</span></button>`
      : `<button type="button" class="lp-b" data-lp="stop">${ICON.stop}<span>${r.stopErr ? "Stop again" : "Stop"}</span></button>`;
    return hero(word, sentence, "work") + system(p, "run") + warnHtml(s) +
      `<div class="lp-acts">${q}${stop}<button type="button" class="lp-b" data-lp="hide"><span>Hide</span></button></div>`;
  }

  /** The stream dropped and couldn't be picked up: the deploy carries on in Space, nothing here spins @param {string} p */
  function lostHtml(p) {
    return hero("Lost touch", "The deploy carries on in Space. Follow it again to see where it is.") + system(p, "run") +
      `<div class="lp-acts"><button type="button" class="lp-go" data-lp="rewatch">${ICON.retry}<span>Follow it again</span></button></div>`;
  }

  /** @param {string} p */
  function liveHtml(p) {
    const s = proj(p), a = s.run?.live || s.check.app, name = esc(s.form?.name || nameOf(p));
    const appUrl = launchpadUrl(s.run?.appId || s.check.app?.id);
    if (a.gone) return head(`${name}'s app is gone`, "Launchpad has no such app for you: it was deleted, or it is someone else's. Its repository, port and settings are still here.", "stop") +
      rec("Create it again", "A new app from the same repository, with the same settings.", "recreate", "Create it again", LP_ICON.rocket) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="unlink"><span>Unlink</span></button></div>`;
    const [tone, words] = a.status && !s.run?.live ? appState(a.status) : ["go", "Live"];
    const of = s.check.app?.of || 1, ready = s.check.app?.ready ?? of, rel = a.release || s.check.app?.release;
    const sentence = tone === "go"
      ? `${rel ? `Release #${rel}` : name} has served${a.at ? ` for ${span(Date.now() - a.at)}` : ""} on ${ready} of ${of} instance${of > 1 ? "s" : ""}.`
      : tone === "work" ? `A new release is rolling out${rel ? `; release #${rel} keeps serving until it's healthy` : ""}.` : tone === "stop" ? "Its instances aren't answering. Deploying again, or the logs in Launchpad, say why." : `${name} isn't serving.`;
    return hero(tone === "go" ? "Live" : words, sentence, tone) + askedHtml(p) +
      system(p, "live") + (s.run?.live ? warnHtml(s) : "") +
      `<div class="lp-acts"><button type="button" class="lp-b" data-lp="again">${LP_ICON.rocket}<span>Deploy again</span></button>${appUrl ? `<a class="lp-b" href="${esc(appUrl)}" target="_blank" rel="noopener"><span>Open in Launchpad</span>${LP_ICON.out}</a>` : ""}` +
      `<span class="lp-mw"><button type="button" class="lp-ib" data-lp="menu" aria-haspopup="menu" aria-expanded="${s.menu}" aria-controls="lp-mn" title="More" aria-label="More">${LP_ICON.more}</button>${s.menu ? `<span class="lp-mn" id="lp-mn" role="menu" aria-label="More"><button type="button" role="menuitem" tabindex="-1" data-lp="unlink">Unlink from Launchpad</button></span>` : ""}</span></div>`;
  }

  /** @param {string} p */
  function failedHtml(p) {
    const s = proj(p), e = s.run.error, name = esc(s.form.name || nameOf(p));
    if (e.code === "build_failed") return hero("The build failed", `${esc(e.text || "")}${e.step ? ` in <code>${esc(e.step)}</code>` : ""}`.trim() || "GitHub Actions couldn't build the image.", "stop") +
      system(p, "run") + (e.log ? `<pre class="lp-log" aria-label="The build log's last lines">${e.log.map(esc).join("\n")}</pre>` : "") +
      rec("Ask an agent to fix it", "In a new thread it reads the log and fixes the cause. Deploy again here once it's merged.", "ask-fix", "Ask an agent", LP_ICON.rocket, s) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Try again</span></button>${e.url ? `<a class="lp-b" href="${esc(e.url)}" target="_blank" rel="noopener"><span>Logs on GitHub</span>${LP_ICON.out}</a>` : ""}</div>`;
    if (e.code === "health_check_failed" && e.declared && e.declared !== e.port) return hero(`${e.release ? `Release #${e.release}` : name} didn't go live`, `Nothing answers on port ${e.port}: the image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}`, "stop") +
      system(p, "run") +
      rec(`Use port ${e.declared}`, `The image listens on ${e.declared}; the app sends traffic to ${e.port}.`, "fix-port", `Use port ${e.declared}`) +
      `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="retry">${ICON.retry}<span>Try again</span></button></div>`;
    if (NEEDS_YOU.has(e.code)) return hero(e.code === "github_workflow_scope" ? "GitHub needs one more permission" : "GitHub isn't connected", e.code === "github_workflow_scope" ? "Launchpad adds a build workflow to the repository, which takes GitHub's <code>workflow</code> permission. Nothing else changes." : esc(e.message || ""), "need") +
      system(p, "run") + (e.source === "gh" && ghCmd(e.fix)
        ? `<div class="lp-rec"><div class="lp-rec-c"><span class="lp-rec-k">${ICON.spark}Recommended</span><b>Grant it to this machine's gh login</b><p>Run this, then check again.</p></div>${cmdHtml(ghCmd(e.fix), s)}<button type="button" class="lp-go" data-lp="recheck-gh">${ICON.retry}<span>I ran it: check again</span></button>${s.ghErr ? `<p class="lp-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div>` +
          `<div class="lp-or"><span>Or</span><button type="button" class="lp-b" data-lp="reconnect">${LP_ICON.github}<span>Reconnect GitHub here</span></button></div>`
        : rec("Reconnect GitHub", "Grant it once; then deploy again.", "reconnect", e.code === "github_workflow_scope" ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github));
    return hero(`${name} didn't deploy`, esc(e.message || e.text || "Something went wrong on the way."), "stop") + system(p, "run") +
      fixOf(e) + actionHtml(e);
  }

  /** What the app reports about the thread an Ask started, by its id; Working only when its agent is at work, never a guess. @param {string} p @param {any} g */
  function askState(p, g) {
    const t = g && g.thread ? findThread(p, g.thread) : null, mine = t && t.thread === g.thread ? t : null;
    if (!mine) return { k: "unknown", word: "Started · its status isn't reported yet" };
    if (mine.done) return { k: "done", word: "Done: merge its work, then deploy" };
    if (mine.busy) return { k: "work", word: "Working" };
    // held back by a gate (the usage limit…): it waits to start, said as the thread says it
    if (mine.held) return { k: "idle", word: mine.held };
    return { k: "idle", word: "Not working right now" };
  }
  /** @param {any} g @param {any} st */
  const askRow = (g, st) => `<ul class="lp-ag"><li><button type="button" class="lp-agr" data-lp="thread" data-go="t:${esc(g.thread)}" title="Open the thread"><span class="lp-t">${ICON.threadOne}${st.k === "work" ? '<i class="arc"></i>' : ""}</span><span class="lp-c"><b>${esc(g.title)}</b><span>${esc(st.word)}</span></span><span class="lp-m">${st.k === "work" ? `<span class="lp-tm">${since(g.since)}</span>` : ""}</span></button></li></ul>`;
  /** The thread an Ask (from a failed deploy) started: its row, with what it means for deploying. @param {string} p */
  function askedHtml(p) {
    const s = proj(p), g = s.asked;
    if (!g || s.check?.state === "needs-agent") return "";
    const st = askState(p, g);
    const line = st.k === "done" ? "Its agent says it's done. Merge its work, then deploy again here." : st.k === "work" ? "An agent is fixing it. Deploy again here once its work is merged." : "A thread was started to fix it. Deploy again here once its work is merged.";
    return `<div class="lp-asked"><p class="lp-note">${line}</p>${askRow(g, st)}</div>`;
  }

  /** @param {string} p */
  function needsHtml(p) {
    const c = proj(p).check;
    return head(`${esc(nameOf(p))} needs preparing first`, "Launchpad can't tell how to run it as it is. An agent can prepare it.") +
      (c.missing.length ? `<ul class="lp-check">${c.missing.map((/** @type {any} */ m) => `<li class="${m.ok ? "is-ok" : "is-no"}"><span class="lp-ck">${m.ok ? ICON.check : ""}</span><span class="lp-c"><b>${esc(cap(m.what))}</b>${m.why ? `<span>${esc(m.why)}</span>` : ""}</span></li>`).join("")}</ul>` : "") +
      rec("Ask an agent to get it ready", "In a new thread it adds what's missing. Once that's merged, deploy from here.", "ask", "Ask an agent", LP_ICON.rocket, proj(p));
  }

  /** @param {string} p */
  function gettingHtml(p) {
    const s = proj(p), g = s.check.getting || findThread(p) || s.asked, st = askState(p, g);
    const line = st.k === "done" ? "Its agent says it's done. Once its work is merged, Deploy is ready here." : st.k === "work" ? "An agent is adding what Launchpad needs. Once its work is merged, Deploy is ready here." : "A thread was started to add what Launchpad needs. Once its work is merged, Deploy is ready here.";
    return head(`Getting ${esc(nameOf(p))} ready`, line) + askRow(g, st) +
      system(p, "preview");
  }

  /** @param {string} p */
  function deviceHtml(p) {
    const d = proj(p).device;
    if (!d.code) return head("Connecting GitHub…", "A GitHub login this machine already has is used as it is.", "need") + `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Asking Space.</span></p>`;
    return head("Connect GitHub", "Enter this code on GitHub. It grants the <code>workflow</code> permission Launchpad needs.", "need") +
      `<div class="lp-code"><code aria-label="The code">${esc(d.code)}</code><button type="button" class="lp-b" data-lp="code-copy">${d.copiedUntil > Date.now() ? ICON.check : ICON.copy}<span>${d.copiedUntil > Date.now() ? "Copied" : "Copy"}</span></button></div>` +
      `<a class="lp-go lp-wide" href="${esc(d.url)}" target="_blank" rel="noopener">${LP_ICON.github}<span>Open GitHub</span>${LP_ICON.out}</a>` +
      `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>Waiting for GitHub. This carries on by itself.</span></p>` +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="device-cancel"><span>Cancel</span></button></div>`;
  }

  /** @param {string} p */
  function pickHtml(p) {
    const s = proj(p), list = s.picking?.apps;
    /** @param {any} w */
    const wait = (w) => `<p class="lp-wait"><i class="lp-arc" aria-hidden="true"></i><span>${w}</span></p>`;
    return head("Link an app on Launchpad", `${esc(nameOf(p))} deploys to the app you pick from now on.`) +
      (s.linking ? wait("Linking…") : !list ? wait("Reading your apps…") : !list.length ? `<p class="lp-note">No apps on Launchpad yet.</p>` :
        `<ul class="lp-also">${list.map((/** @type {any} */ a) => `<li><button type="button" class="lp-appr" data-lp="link" data-id="${esc(a.id)}"${a.linkable ? "" : ` disabled title="Not built from GitHub, so XO can't deploy to it"`}><span class="lp-t">${LP_ICON.app}</span><span class="lp-c"><b>${esc(a.name)}</b>${a.linkable ? `<span class="lp-mono">${esc(a.host)}</span>` : "<span>Not built from GitHub: XO can't deploy to it</span>"}</span><span class="lp-m">${((t, w) => `<span class="lp-st t-${t}">${t === "work" ? '<i class="lp-arc" aria-hidden="true"></i>' : "<i></i>"}${esc(w)}</span>`)(...appState(a.status))}</span></button></li>`).join("")}</ul>`) +
      `<div class="lp-alt"><button type="button" class="lp-a" data-lp="pick-cancel"><span>Back</span></button></div>`;
  }

  /** @param {string} p */
  function checkingHtml(p) {
    return head(`Checking ${esc(nameOf(p))}…`, "Its repository, its port and what it needs to run.") +
      `<div class="lpm is-skel" aria-hidden="true"><div class="lpm-row">${'<span class="lpm-n"><i class="lpm-t"></i><b></b></span><span class="lpm-l"></span>'.repeat(3)}<span class="lpm-n"><i class="lpm-t"></i><b></b></span></div></div>`;
  }

  /** @param {string} p */
  function bodyHtml(p) {
    const sc = L.screen(p);
    const s = proj(p), c = s.check;
    return {
      key: `${p}|${sc}` + (sc === "setup" ? `|${formKey(c, { pre: s.pre, needs: s.needs && [s.needs.code, s.needs.message, s.needs.fix, s.needs.action, s.needs.data?.repo, s.needs.data?.origin, s.needs.data?.branch, (s.needs.data?.apps || []).map((/** @type {any} */ a) => `${a.id}/${a.slug || ""}/${a.workflow || ""}`).join()], errs: s.form.errs || {}, envAll: !!s.envAll, editing: !!s.editing, machine: !!s.machine, disk: !!s.form.disk, thread: !!S.v?.startsWith("t:"), ghErr: s.ghErr || "", asked: !!s.asked })}` : ""),
      html: sc === "checking" ? checkingHtml(p) : sc === "check-failed" ? head("Couldn't check this project", esc(proj(p).err?.message || "XO Space didn't answer.")) + `<div class="lp-acts"><button type="button" class="lp-b" data-lp="recheck">${ICON.retry}<span>Try again</span></button></div>`
        : sc === "setup" ? setupHtml(p) : sc === "undo" || sc === "run" ? runHtml(p) : sc === "lost" ? lostHtml(p) : sc === "live" ? liveHtml(p) : sc === "failed" ? failedHtml(p)
        : sc === "needs" ? needsHtml(p) : sc === "getting" ? gettingHtml(p) : sc === "device" ? deviceHtml(p) : sc === "pick" ? pickHtml(p) : "",
      form: sc === "setup",
    };
  }

  Object.assign(L, { askState, bodyHtml, hintFor });
}
