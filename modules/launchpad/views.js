// @ts-check
import { ICON } from "../../core/ui/icons/names.js";
import { ARC } from "../../core/ui/icons/icon.js";
import { esc } from "../../core/platform/index.js";
import { appState, formKey, launchpadUrl, nextStep } from "./model.js";
import { LP_ICON, NEEDS_YOU, since, where, cap, sizeText, lit, fixOf, ghCmd, cmdHtml, repoFacts, appsFacts, sizeHint, failWords, NODES, ago } from "./words.js";
import { createSystem } from "./system.js";
/** @import { LaunchpadCheck, LaunchpadForm, LaunchpadProject, LaunchpadViewOptions, PrepThread } from "./lifetime-types.d.ts" */

/** @typedef {{name: string, source: string, sensitive: boolean, default: string, set: boolean}} LaunchEnv */

/** @param {LaunchpadViewOptions} L */
export function installViews(L) {
  const { S, proj, nameOf, findThread, screen, summary } = L;
  const { track, details } = createSystem(L);
  /** @param {{action?: string, url?: string}} e */
  const actionHtml = (e) => {
    const a = nextStep(e.action || "");
    if (!a) return e.action === "none" ? "" : `<div class="lq-acts lp-acts">${btn("retry", "Deploy again once that's done", ICON.retry)}</div>`;
    if (a[1] === "log") return e.url ? `<div class="lq-acts lp-acts">${out(e.url, a[0], true)}</div>` : "";
    return `<div class="lq-acts lp-acts">${btn(a[1], a[0], a[1] === "reconnect" ? LP_ICON.github : a[1] === "retry" ? ICON.retry : "", true)}</div>`;
  };
  /** @param {string} act @param {string} label */
  const btn = (act, label, icon = "", lit = false, more = "") => `<button type="button" class="btn ${lit ? "btn-pri lp-go" : "lp-b"}" data-lp="${act}"${more}>${icon}<span>${label}</span></button>`;
  /** @param {string} href @param {string} label */
  const out = (href, label, lit = false) => { const h = esc(href), in_ = `<span>${label}</span>${LP_ICON.out}`; return lit ? `<a class="btn btn-pri lp-go" href="${h}" target="_blank" rel="noopener">${in_}</a>` : `<a class="btn lp-b" href="${h}" target="_blank" rel="noopener">${in_}</a>`; };
  /** @param {string} tone @param {string} words */
  const eye = (tone, words, meta = "") => `<p class="lq-eye${tone ? ` t-${tone}` : ""}"><i aria-hidden="true"></i><span>${words}</span>${meta ? `<em>· ${meta}</em>` : ""}</p>`;
  /** @param {{title: string, tone?: string, words?: string, meta?: string, sub?: string, addr?: string, acts?: string}} data */
  const top = ({ tone = "", words = "", meta = "", title, sub = "", addr = "", acts = "" }) =>
    `<header class="lq-top">${words ? eye(tone, words, meta) : ""}<div class="lq-hero"><h2 class="lq-t lp-h" id="lq-title">${title}</h2>${addr}${sub ? `<p class="lq-sub lp-p">${sub}</p>` : ""}${acts ? `<div class="lq-acts lp-acts">${acts}</div>` : ""}</div></header>`;
  /** @param {{copied: number}} s @param {{host?: string, url?: string} | null} a */
  const addrHtml = (s, a, on = true) => (a?.host ? `<p class="lq-addr${on ? "" : " is-off"}"><a class="lq-host" href="${esc(a.url)}" target="_blank" rel="noopener" title="Open ${esc(a.host)}">${esc(a.host)}</a><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button></p>` : "");

  /** @param {string} title @param {string} text @param {string} act @param {string} label @param {LaunchpadProject | null} s */
  const rec = (title, text, act, label, icon = "", s = null, alts = "", tone = "") => {
    const asking = s && s.asking && /^ask/.test(act), err = s && !s.asking && s.askErr && /^ask/.test(act) ? s.askErr : "";
    return `<div class="lq-note lp-rec${tone ? ` t-${tone}` : ""}"><div class="lq-nc"><b>${title}</b><p>${text}</p>${err ? `<p class="lp-err" role="status">Couldn't start the thread: ${esc(err)}.</p>` : ""}</div>` +
      `<div class="lq-acts">${alts}<button type="button" class="btn btn-pri lp-go" data-lp="${act}"${asking ? ' aria-disabled="true"' : ""}>${asking ? '<i class="spin lp-arc" aria-hidden="true"></i><span>Starting a thread…</span>' : `${icon}<span>${err ? "Try again" : label}</span>`}</button></div></div>`;
  };
  /** @param {string} p */
  function setupHtml(p) {
    const s = proj(p), c = s.check, f = s.form;
    if (!c || !f) throw new Error("Launchpad setup requires a check and form");
    const e = f.errs || {};
    const scope = c.github && c.github.connected && c.github.workflow;
    const guessed = c.state === "detectable";
    const env = c.env || [];
    const from = [...new Set(env.map((/** @type {LaunchEnv} */ x) => x.source).filter(Boolean))].join(", ");
    const mine = env.filter((/** @type {LaunchEnv} */ x) => x.sensitive || !x.default || f.env[x.name] || s.envAll || (s.editing && c.app)), rest = env.length - mine.length;
    const nd = s.needs;
    const editing = !!(s.editing && c.app);
    const sm = editing ? summary(p) : null;
    const decline = nd?.code === "confirm_repo" ? btn("decline-repo", "Not this repository") : nd?.code === "other_apps" ? btn("decline-apps", "Don't push") : "";
    return (sm ? top({ tone: sm.tone, words: sm.words, title: `${esc(nameOf(p))}'s settings`, sub: `Change what you need; ${c.behind ? `it deploys again with them, and with ${esc(c.repo.branch || "main")}'s commits since the live release` : "the live commit is built again with them"}. Values left empty stay as they are on Launchpad.` })
      : top({ words: "Not on the web yet", title: `Put ${esc(nameOf(p))} on the web`, sub: guessed ? "Found these in the project. Check them, then deploy." : "Launchpad builds it on every push and runs it at an address of its own. Nothing goes out until you press Deploy." })) +
      askedHtml(p) +
      (nd ? `<div class="lq-note lp-rec lp-ask t-need"><div class="lq-nc"><b>${esc(nd.message || "")}</b>${nd.fix ? `<p>${esc(nd.fix)}</p>` : ""}${nd.code === "confirm_repo" ? repoFacts(nd) : nd.code === "other_apps" ? appsFacts(nd) : ""}</div>${decline || lit(nd) ? `<div class="lq-acts">${decline}${lit(nd) ? btn(lit(nd)[1], esc(lit(nd)[0]), "", true) : ""}</div>` : ""}</div>` : "") +
      (c.blockers.length ? `<p class="lp-note t-need">Deploy would stop here: ${esc(c.blockers.join("; "))}.</p>` : "") +
      // what Space warned of before the button is pressed (a repository that isn't the person's own, uncommitted changes, …)
      (c.warnings.length ? c.warnings.map((/** @type {string} */ w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("") : "") +
      (editing ? "" : track(p, "preview")) +
      (c.github.source === "gh" && c.github.connected && !c.github.workflow && ghCmd(c.github.fix) ? `<div class="lp-gh"><p class="lp-note">Or grant it to this machine's gh login, then check again:</p>${cmdHtml(ghCmd(c.github.fix), s)}<div class="lq-acts">${s.pre === 1 ? `<button type="button" class="btn lp-b" data-lp="recheck-gh" aria-disabled="true"><i class="spin lp-arc" aria-hidden="true"></i><span>Checking GitHub…</span></button>` : btn("recheck-gh", "I ran it: check again", ICON.retry)}</div>${s.ghErr ? `<p class="lp-err lp-gh-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div>` : "") +
      (S.v && S.v.startsWith("t:") ? `<p class="lp-note lp-src" title="This thread's work goes out once it's merged into ${esc(c.repo.branch || "main")}">${ICON.branch}<span>Deploys <b>${esc(c.repo.branch || "main")}</b>, not this thread's branch.</span></p>` : "") +
      `<p class="lq-h">Setup</p><div class="lq-group lp-set">` +
      (editing ? "" : field("name", "Name", f.name, { hint: e.name || "It can't change later.", bad: !!e.name, fix: e.nameFix })) +
      field("port", "Port", f.port, { hint: e.port || (c.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${esc(where(c.portFrom))}` : "Where the app listens"), bad: !!e.port, mode: "numeric", short: true }) +
      machineRows(s, c, f, editing ? c.app : null) +
      // once a repository name had to be chosen, its field stays while you change it (a fixed error mustn't make it vanish)
      (e.repo || f.repoChosen ? field("repo", "Repository", f.repo, { hint: e.repo || hintFor("repo", p), bad: !!e.repo }) : "") +
      `</div>` +
      (env.length ? `<p class="lq-h" id="lq-env">Environment${from ? ` <span>from ${esc(from)}</span>` : ""}</p><fieldset class="lq-group lp-env" aria-labelledby="lq-env">` +
        mine.map((/** @type {LaunchEnv} */ x) => `<label class="lq-row lp-f lp-ev"><span class="lq-k lp-l lp-mono" title="${esc(x.name)}">${esc(x.name)}</span><span class="lq-v lp-v"><input class="lq-in lp-in" data-lp-env="${esc(x.name)}" type="${x.sensitive ? "password" : "text"}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(editing && x.set ? "Set · leave to keep" : x.default || "Not set")}" aria-label="${esc(x.name)}"></span></label>`).join("") +
        (rest ? `<button type="button" class="lq-row lq-more lp-a lp-more" data-lp="env-all"><span>${rest} more with example values</span>${ICON.chevron || ""}</button>` : "") +
        `</fieldset><p class="lp-lock">${ICON.lock}<span>Straight to Launchpad; XO never keeps them.</span></p>` : "") +
      (scope ? "" : `<p class="lp-note t-need lp-gh-why">${ghWhy(c.github)}</p>`) +
      `<div class="lq-foot lp-foot">` +
      (editing ? `<button type="button" class="lq-link lp-a" data-lp="edit-cancel"><span>Cancel</span></button>`
        : `<button type="button" class="lq-link lp-a" data-lp="pick">${LP_ICON.link}<span>Link an app already on Launchpad</span></button>`) +
      `<div class="lq-acts">` + (scope
        ? `<button type="button" class="btn lp-go${nd && lit(nd) ? " is-quiet" : " btn-pri"}" data-lp="deploy"${s.pre === 1 ? ' aria-busy="true"' : ""}>${s.pre === 1 ? '<i class="spin" aria-hidden="true"></i>' : LP_ICON.rocket}<span>${editing ? "Deploy with these" : `Deploy ${esc(f.name || nameOf(p))}`}</span></button>`
        : btn("reconnect", c.github.connected || c.github.error ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github, true)) + `</div></div>`;
  }
  /** @param {{error?: string, connected?: boolean}} g */
  const ghWhy = (g) => (g.error === "github_token_invalid" ? "GitHub's sign-in has expired, so Launchpad can't push to deploy. Reconnect it to go on."
    : !g.connected ? "Launchpad deploys from your repository on GitHub. Connect it to go on." : "GitHub needs the workflow permission before Launchpad can deploy. Reconnect it to grant it.");
  /** @param {string} label @param {string} inner */
  const row = (label, inner, bad = false, tag = "div", end = "") => `<${tag} class="lq-row lp-f${bad ? " is-bad" : ""}"><span class="lq-k lp-l">${label}</span>${inner}${end}</${tag}>`;
  /** @param {LaunchpadProject} s @param {LaunchpadCheck} c @param {LaunchpadForm} f @param {LaunchpadCheck["app"]} a */
  function machineRows(s, c, f, a) {
    const e = f.errs || {};
    /** @param {string} id */
    const ids = (id) => `aria-describedby="lp-h-${id}"${e[id] ? ' aria-invalid="true"' : ""}`;
    /** @param {string} id @param {string} text */
    const hint = (id, text) => `<small class="lp-hint" id="lp-h-${id}">${text}</small>`;
    if (a) {
      return (a.size || a.sizeLabel ? row("Size", `<span class="lq-v lp-v"><span class="lp-ro">${esc(sizeText(c, a.size, a.sizeLabel))}</span>${hint("size", "Fixed when it was created.")}</span>`) : "") +
        (a.storage === undefined ? "" : a.storage
          ? row("Disk", `<span class="lq-v lp-v"><span class="lp-pair"><input class="lq-in lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u lp-at">GB at <code>${esc(a.storage.path)}</code></span></span>${hint("disk", e.disk || "Grows, never shrinks.")}</span>`, !!e.disk, "label")
          : row("Disk", `<span class="lq-v lp-v"><span class="lp-ro">None</span>${hint("disk", "Can't be added after creation.")}</span>`));
    }
    const z = c.sizes, at = f.size || z?.def || "";
    if (!z) return "";
    if (!(s.machine || e.size || e.disk)) {
      const t = z.tiers.find((/** @type {{name: string}} */ x) => x.name === at);
      return row("Machine", `<span class="lq-v lp-v"><span class="lp-ro">${esc(t ? t.label : "Launchpad's default")}</span><small>${esc(t ? `${t.cpu} CPU · ${t.memory_gb} GB memory` : "Its size, as Launchpad picks")}${f.disk ? ` · ${esc(f.diskGb)} GB disk` : ""}</small></span>`, false, "div",
        `<button type="button" class="lq-go lp-a lp-chg" data-lp="machine-open" aria-label="Change the machine">Change${ICON.right}</button>`);
    }
    return row("Size", `<span class="lq-v lp-v"><xo-select class="lp-xs" data-lp-f="size" aria-label="Size" ${ids("size")}>${z.def ? "" : `<option value=""${at ? "" : " selected"}>Launchpad's default</option>`}` +
        z.tiers.map((/** @type {{name: string, label: string, cpu: number, memory_gb: number}} */ t) => `<option value="${esc(t.name)}"${at === t.name ? " selected" : ""}${t.name === z.def ? ' data-desc="Default"' : ""}>${esc(`${t.label} · ${t.cpu} CPU, ${t.memory_gb} GB`)}</option>`).join("") +
        `</xo-select>${hint("size", e.size || sizeHint(c, f))}</span>`, !!e.size) +
      (f.disk
        ? row("Disk", `<span class="lq-v lp-v"><span class="lp-pair"><input class="lq-in lp-in lp-mono" data-lp-f="diskPath" value="${esc(f.diskPath)}" placeholder="/data" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Where the disk is mounted" ${ids("disk")}><input class="lq-in lp-in is-gb" data-lp-f="diskGb" value="${esc(f.diskGb)}" inputmode="numeric" autocomplete="off" aria-label="Disk size in GB" ${ids("disk")}><span class="lp-u">GB</span></span>${hint("disk", e.disk || "Grows later, never shrinks.")}</span>`, !!e.disk, "div",
          `<button type="button" class="lp-ib" data-lp="disk-remove" title="No disk" aria-label="No disk">${ICON.close}</button>`)
        : row("Disk", `<span class="lq-v lp-v"><span class="lp-ro">None</span>${hint("disk", "Only at creation")}</span>`, false, "div",
          `<button type="button" class="lq-go lp-a lp-add" data-lp="disk-add">${ICON.plus}<span>Add a disk</span></button>`));
  }
  /** @param {string} k @param {string} p */
  function hintFor(k, p) {
    const s = proj(p), c = s.check, f = s.form, editing = !!(s.editing && c?.app);
    if (k === "name") return "It can't change later.";
    if (k === "port") {
      return c?.portFrom ? `${c.portSure === false ? "A guess from" : "From"} ${where(c.portFrom)}` : "Where the app listens";
    }
    if (k === "size" && c && f) return sizeHint(c, f);
    if (k === "disk") return editing ? "Grows, never shrinks." : "Grows later, never shrinks.";
    if (k === "repo") return "A new repository on your GitHub.";
    return "";
  }
  /** @param {string} id @param {string} label @param {string} value */
  function field(id, label, value, { hint = "", bad = false, mode = "text", short = false, fix = "" } = {}) {
    // the field sits on its row, borderless, its hint under it on the same edge; Launchpad's free name is a button under the hint
    return row(label, `<span class="lq-v lp-v"><input class="lq-in lp-in${short ? " is-short" : ""}" data-lp-f="${id}" value="${esc(value || "")}" inputmode="${mode}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="lp-h-${id}"${bad ? ' aria-invalid="true"' : ""}><small class="lp-hint" id="lp-h-${id}">${hint}</small>${fix ? `<button type="button" class="btn lp-b lp-fix" data-lp="use-name" data-v="${esc(fix)}">Use ${esc(fix)}</button>` : ""}</span>`, bad, "label");
  }

  /** @param {LaunchpadProject} s */
  const warnHtml = (s) => (s.warn || []).map((w) => `<p class="lp-note t-need">${esc(w)}</p>`).join("");
  /** @param {string} p */
  const appName = (p) => esc(proj(p).form?.name || proj(p).check?.app?.name || nameOf(p));

  /** @param {string} p */
  function runHtml(p) {
    const s = proj(p), r = s.run, c = s.check, name = appName(p);
    if (!c || !r) throw new Error("Launchpad deploy requires a check and run");
    const was = c.app;
    if (r.undo) return top({ tone: "work", words: "Starting", title: name, sub: `Deploying ${name} in <span class="lp-count" data-until="${r.undo}">${Math.max(1, Math.ceil((r.undo - Date.now()) / 1000))}</span> s.`, acts: btn("undo", "Undo", ICON.undo) }) + track(p, "run");
    const on = NODES.find((n) => r.steps[n]?.state === "doing") || "repo", rel = r.steps.release || {}, build = r.steps.build || {};
    const word = { repo: "Pushing", build: "Building", release: `Rolling out${r.release ? ` #${r.release}` : ""}`, live: "Going live" }[on];
    const sentence = on === "release" && rel.of
      ? `${rel.ready} of ${rel.of} new instance${rel.of > 1 ? "s" : ""} ${rel.of > 1 ? "are" : "is"} ready.${was?.release ? ` Release #${was.release} keeps serving until the new one is healthy.` : ""}`
      : `${{ repo: `Pushing ${esc(c.repo.branch || "main")} to GitHub.`, build: "GitHub Actions is building the image.", release: "Launchpad is starting the new release.", live: "Going live." }[on]}${was?.release && on !== "release" ? ` Release #${was.release} keeps serving.` : ""}`;
    const q = r.stopErr ? `<p class="lp-q t-need" role="status">Couldn't stop it: ${esc(r.stopErr)}. It's still deploying.</p>`
      : r.stopSent ? `<p class="lp-q" role="status">Stopping… it stops once Space confirms.</p>`
      : r.stopping ? `<p class="lp-q" role="status">Stops in <span class="lp-count" data-until="${r.stopAt}">${Math.max(1, Math.ceil((Number(r.stopAt) - Date.now()) / 1000))}</span> s.</p>`
      : `<p class="lp-q">You can close this window. It carries on, and Coworker tells you when it's live.</p>`;
    const stop = r.stopSent ? `<button type="button" class="btn lp-b" data-lp="stop" aria-disabled="true"><i class="spin lp-arc" aria-hidden="true"></i><span>Stopping…</span></button>`
      : r.stopping ? btn("stop-undo", "Keep deploying")
      : btn("stop", r.stopErr ? "Stop again" : "Stop", ICON.stop);
    return top({ tone: "work", words: word, meta: `${since(r.startedAt)} in all`, title: name, addr: addrHtml(s, was), sub: sentence, acts: stop + (build.url ? out(build.url, "Show log") : "") }) +
      track(p, "run") + q + warnHtml(s) + details(p);
  }

  /** @param {string} p */
  function lostHtml(p) {
    return top({ words: "Lost touch", title: appName(p), sub: "The deploy carries on in Space. Follow it again to see where it is.", acts: btn("rewatch", "Follow it again", ICON.retry, true) }) + track(p, "run");
  }

  /** @param {string} p */
  function liveHtml(p) {
    const s = proj(p), live = s.run?.live, app = s.check?.app, a = live || app, name = appName(p);
    if (!a) throw new Error("Launchpad live screen requires an app");
    const appUrl = launchpadUrl(s.run?.appId || app?.id);
    if (!live && app?.gone) return top({ tone: "stop", words: "App not on Launchpad", title: `${name}'s app is gone`, sub: "Launchpad has no such app for you: it was deleted, or it is someone else's. Its repository, port and settings are still here." }) +
      rec("Create it again", "A new app from the same repository, with the same settings.", "recreate", "Create it again", LP_ICON.rocket, null, btn("unlink", "Unlink"));
    const [tone, words] = app?.status && !live ? appState(app.status) : ["go", "Live"];
    const rel = a.release || app?.release;
    const sentence = tone === "go" ? "" : tone === "work" ? `A new release is rolling out${rel ? `; release #${rel} keeps serving until it's healthy` : ""}.` : tone === "stop" ? "Its instances aren't answering. Deploying again, or the logs in Launchpad, say why." : `${name} isn't serving.`;
    const menu = `<span class="lp-mw"><button type="button" class="lp-ib lq-more-b" data-lp="menu" aria-haspopup="menu" aria-expanded="${s.menu}" aria-controls="lp-mn" title="More" aria-label="More">${LP_ICON.more}</button>${s.menu ? `<span class="lp-mn" id="lp-mn" role="menu" aria-label="More" tabindex="-1">${appUrl ? `<a role="menuitem" tabindex="-1" href="${esc(appUrl)}" target="_blank" rel="noopener">Open in Launchpad</a>` : ""}<button type="button" role="menuitem" tabindex="-1" data-lp="unlink">Unlink from Launchpad</button></span>` : ""}</span>`;
    return top({ tone, words: tone === "go" ? "Live" : words, meta: rel ? `Release #${rel}${a.at ? ` · ${ago(a.at)}` : ""}` : a.at ? ago(a.at) : "", title: name, addr: addrHtml(s, a, tone === "go"), sub: sentence,
      acts: btn("again", "Deploy again", LP_ICON.rocket) + (a.url ? out(a.url, "Open", true) : "") + menu }) +
      askedHtml(p) + track(p, "live") + (s.run?.live ? warnHtml(s) : "") + details(p);
  }

  /** @param {string} p */
  function failedHtml(p) {
    const s = proj(p), e = s.run?.error, name = appName(p), was = s.check?.app ?? null;
    if (!e) throw new Error("Launchpad failed screen requires a deploy error");
    /** @param {string} tone @param {string} sub */
    const head = (tone, sub, acts = "") => top({ tone, words: failWords(e), meta: e.release ? `Release #${e.release}` : "", title: name, addr: addrHtml(s, was), sub, acts });
    if (e.code === "build_failed") return head("stop", `${esc(e.text || "")}${e.step ? ` in <code>${esc(e.step)}</code>` : ""}`.trim() || "GitHub Actions couldn't build the image.", e.url ? out(e.url, "Logs on GitHub") : "") +
      track(p, "run") + (e.log ? `<pre class="lp-log" aria-label="The build log's last lines">${e.log.map(esc).join("\n")}</pre>` : "") +
      rec("Ask an agent to fix it", "In a new thread it reads the log and fixes the cause. Deploy again here once it's merged.", "ask-fix", "Ask an agent", "", s, btn("retry", "Try again", ICON.retry), "stop") + details(p);
    if (e.code === "health_check_failed" && e.declared && e.declared !== e.port) return head("stop", "") + track(p, "run") +
      rec(`Nothing answered on port ${e.port}`, `The image listens on ${e.declared}.${e.last ? ` Release #${e.last} keeps serving.` : ""}`, "fix-port", `Use port ${e.declared}`, "", null, btn("retry", "Try again", ICON.retry), "stop") + details(p);
    if (NEEDS_YOU.has(e.code)) return top({ tone: "need", words: failWords(e), title: e.code === "github_workflow_scope" ? "GitHub needs one more permission" : "GitHub isn't connected", sub: e.code === "github_workflow_scope" ? "Launchpad adds a build workflow to the repository, which takes GitHub's <code>workflow</code> permission. Nothing else changes." : esc(e.message || "") }) +
      track(p, "run") + (e.source === "gh" && ghCmd(e.fix || "")
        ? `<div class="lq-note lp-rec"><div class="lq-nc"><b>Grant it to this machine's gh login</b><p>Run this, then check again.</p>${cmdHtml(ghCmd(e.fix || ""), s)}${s.ghErr ? `<p class="lp-err" role="status">Couldn't check GitHub: ${esc(s.ghErr)}.</p>` : ""}</div><div class="lq-acts">${btn("reconnect", "Reconnect GitHub here", LP_ICON.github)}${btn("recheck-gh", "I ran it: check again", ICON.retry, true)}</div></div>`
        : rec("Reconnect GitHub", "Grant it once; then deploy again.", "reconnect", e.code === "github_workflow_scope" ? "Reconnect GitHub" : "Connect GitHub", LP_ICON.github));
    return top({ tone: "stop", words: failWords(e), title: `${name} didn't deploy`, addr: addrHtml(s, was), sub: esc(e.message || e.text || "Something went wrong on the way.") }) + track(p, "run") +
      fixOf(e) + actionHtml(e) + details(p);
  }

  /** @param {string} p @param {PrepThread | null | undefined} g */
  function askState(p, g) {
    const thread = g?.thread, t = thread ? findThread(p, thread) : null, mine = t?.thread === thread ? t : null;
    if (!mine) return { k: "unknown", word: "Started · its status isn't reported yet" };
    if (mine.done) return { k: "done", word: "Done: merge its work, then deploy" };
    if (mine.busy) return { k: "work", word: "Working" };
    // held back by a gate (the usage limit…): it waits to start, said as the thread says it
    if (mine.held) return { k: "idle", word: mine.held };
    return { k: "idle", word: "Not working right now" };
  }
  /** @param {PrepThread} g @param {{k: string, word: string}} st */
  const askRow = (g, st) => {
    const busy = st.k === "work", elapsed = busy ? `<span class="lp-tm">${since(g.since)}</span>` : "";
    return `<ul class="lq-group lp-ag"><li><button type="button" class="lq-row lp-agr" data-lp="thread"` +
      ` data-go="t:${esc(g.thread)}" title="Open the thread"><span class="lp-t">${ICON.threadOne}${busy ? ARC : ""}</span>` +
      `<span class="lq-v lp-c"><b>${esc(g.title)}</b><small>${esc(st.word)}</small></span>` +
      `<span class="lp-m">${elapsed}${ICON.right}</span></button></li></ul>`;
  };
  /** @param {string} p */
  function askedHtml(p) {
    const s = proj(p), g = s.asked;
    if (!g || s.check?.state === "needs-agent") return "";
    const st = askState(p, g);
    const line = st.k === "done" ? "Its agent says it's done. Merge its work, then deploy again here." : st.k === "work" ? "An agent is fixing it. Deploy again here once its work is merged." : "A thread was started to fix it. Deploy again here once its work is merged.";
    return `<div class="lp-asked"><p class="lq-h">${line}</p>${askRow(g, st)}</div>`;
  }

  /** @param {string} p */
  function needsHtml(p) {
    const c = proj(p).check;
    if (!c) throw new Error("Launchpad needs screen requires a check");
    return top({ words: "Not ready yet", title: `${esc(nameOf(p))} needs preparing first`, sub: "Launchpad can't tell how to run it as it is. An agent can prepare it." }) +
      (c.missing.length ? `<p class="lq-h">What Launchpad looks for</p><ul class="lq-group lp-check">${c.missing.map((/** @type {{ok: boolean, what: string, why?: string}} */ m) => `<li class="lq-row ${m.ok ? "is-ok" : "is-no"}"><span class="lp-ck">${m.ok ? ICON.check : ""}</span><span class="lq-v lp-c"><b>${esc(cap(m.what))}</b>${m.why ? `<small>${esc(m.why)}</small>` : ""}</span></li>`).join("")}</ul>` : "") +
      rec("Ask an agent to get it ready", "In a new thread it adds what's missing. Once that's merged, deploy from here.", "ask", "Ask an agent", "", proj(p));
  }

  /** @param {string} p */
  function gettingHtml(p) {
    const s = proj(p), g = s.check?.getting || findThread(p) || s.asked, st = askState(p, g), sm = summary(p);
    if (!g) throw new Error("Launchpad getting screen requires a preparation thread");
    const line = st.k === "done" ? "Its agent says it's done. Once its work is merged, Deploy is ready here." : st.k === "work" ? "An agent is adding what Launchpad needs. Once its work is merged, Deploy is ready here." : "A thread was started to add what Launchpad needs. Once its work is merged, Deploy is ready here.";
    return top({ tone: sm.tone, words: sm.words, title: `Getting ${esc(nameOf(p))} ready`, sub: line }) + askRow(g, st) + track(p, "preview");
  }

  /** @param {string} p */
  function deviceHtml(p) {
    const d = proj(p).device;
    if (!d) throw new Error("Launchpad device screen requires a connection");
    /** @param {string} w */
    const wait = (w) => `<p class="lp-wait"><i class="spin lp-arc" aria-hidden="true"></i><span>${w}</span></p>`;
    if (!d.code) return top({ tone: "need", words: "Waiting for GitHub", title: "Connecting GitHub…", sub: "A GitHub login this machine already has is used as it is." }) + wait("Asking Space.");
    return top({ tone: "need", words: "Waiting for GitHub", title: "Connect GitHub", sub: "Enter this code on GitHub. It grants the <code>workflow</code> permission Launchpad needs." }) +
      `<div class="lp-code"><code aria-label="The code">${esc(d.code)}</code>${btn("code-copy", d.copiedUntil > Date.now() ? "Copied" : "Copy", d.copiedUntil > Date.now() ? ICON.check : ICON.copy)}</div>` +
      wait("Waiting for GitHub. This carries on by itself.") +
      `<div class="lq-foot"><button type="button" class="lq-link lp-a" data-lp="device-cancel"><span>Cancel</span></button><div class="lq-acts"><a class="btn btn-pri lp-go" href="${esc(d.url)}" target="_blank" rel="noopener">${LP_ICON.github}<span>Open GitHub</span>${LP_ICON.out}</a></div></div>`;
  }

  /** @param {string} p */
  function pickHtml(p) {
    const s = proj(p), list = s.picking?.apps;
    /** @param {string} w */
    const wait = (w) => `<p class="lp-wait"><i class="spin" aria-hidden="true"></i><span>${w}</span></p>`;
    return top({ title: "Link an app on Launchpad", sub: `${esc(nameOf(p))} deploys to the app you pick from now on.` }) +
      (s.linking ? wait("Linking…") : !list ? wait("Reading your apps…") : !list.length ? `<p class="lp-note">No apps on Launchpad yet.</p>` :
        `<p class="lq-h">Your apps on Launchpad</p><ul class="lq-group lp-also">${list.map((/** @type {{id: string, name: string, host: string, linkable: boolean, status: string}} */ a) => `<li><button type="button" class="lq-row lp-appr" data-lp="link" data-id="${esc(a.id)}"${a.linkable ? "" : ` disabled title="Not built from GitHub, so XO can't deploy to it"`}><span class="lp-t">${LP_ICON.app}</span><span class="lq-v lp-c"><b>${esc(a.name)}</b>${a.linkable ? `<small class="lp-mono">${esc(a.host)}</small>` : "<small>Not built from GitHub: XO can't deploy to it</small>"}</span><span class="lp-m">${((t, w) => eye(t === "stop" ? "stop" : t, esc(w)))(...appState(a.status))}</span></button></li>`).join("")}</ul>`) +
      `<div class="lq-foot"><button type="button" class="lq-link lp-a" data-lp="pick-cancel">${ICON.back}<span>Back</span></button></div>`;
  }

  /** @param {string} p */
  function checkingHtml(p) {
    return `<div class="m-load" role="status"><i class="spin is-load" aria-hidden="true"></i><span class="sr-only">Checking ${esc(nameOf(p))}…</span></div>`;
  }

  /** @param {string} p */
  function bodyHtml(p) {
    const sc = screen(p);
    const s = proj(p), error = s.err;
    const message = error && typeof error === "object" && "message" in error ? error.message : "";
    let key = `${p}|${sc}`;
    if (sc === "setup") {
      const { check, form, needs } = s;
      if (!check || !form) throw new Error("Launchpad setup requires a check and form");
      const data = needs?.data, apps = (data?.apps || []).map((a) => `${a.id}/${a.slug || ""}/${a.workflow || ""}`).join();
      key += `|${formKey(check, {
        pre: s.pre, needs: needs && [needs.code, needs.message, needs.fix, needs.action, data?.repo, data?.origin, data?.branch, apps],
        errs: form.errs || {}, envAll: !!s.envAll, editing: !!s.editing, machine: !!s.machine, disk: !!form.disk,
        thread: !!S.v?.startsWith("t:"), ghErr: s.ghErr || "", asked: !!s.asked,
      })}`;
    }
    return {
      key,
      html: sc === "checking" ? checkingHtml(p) : sc === "check-failed"
        ? top({ words: "Couldn't check", title: "Couldn't check this project", sub: esc(message || "XO Space didn't answer."),
          acts: btn("recheck", "Try again", ICON.retry) })
        : sc === "setup" ? setupHtml(p) : sc === "undo" || sc === "run" ? runHtml(p) : sc === "lost" ? lostHtml(p) : sc === "live" ? liveHtml(p) : sc === "failed" ? failedHtml(p)
        : sc === "needs" ? needsHtml(p) : sc === "getting" ? gettingHtml(p) : sc === "device" ? deviceHtml(p) : sc === "pick" ? pickHtml(p) : "",
      form: sc === "setup",
    };
  }

  Object.assign(L, { askState, bodyHtml, hintFor });
}
