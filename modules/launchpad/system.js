// @ts-check

// The system view, after the Launchpad demo: visitors, the address, the running app and its image; only what Space says is drawn.
import { ICON } from "../../core/ui/icons/names.js";
import { esc } from "../../core/platform/index.js";
import { appState } from "./model.js";
import { LP_ICON, ago, since, split, sizeText } from "./words.js";

/** The section's system(p, mode), for the preview, a run and what runs. @param {any} L */
export function createSystem(L) {
  const { proj, nameOf } = L;
  /** @param {string} p @param {string} mode */
  function system(p, mode) {
    const s = proj(p), c = s.check, f = s.form, r = s.run;
    const admin = c.repo && (c.repo.admin || !c.github?.connected);
    const app = r?.live || (mode === "live" ? c.app : null);
    const real = app?.host || "";
    const [mine, domain] = real ? split(real) : ["", ""];
    const port = f.port || "—";
    const name = esc(f.name || c.app?.name || nameOf(p));
    // how each part stands
    let img = "plan", inst = "plan", addr = "plan", imgText = "", instText = "", instWord = "On launch", imgAt = 0, instAt = 0;
    if (mode === "live") {
      const [tone, words] = c.app?.status && !r?.live ? appState(c.app.status) : ["go", "Live"];
      img = "ready";
      inst = { go: "ready", work: "starting", stop: "failing" }[tone] || "none";
      instWord = { go: "Serving", work: "Rolling out", stop: "Not ready" }[tone] || words;
      addr = tone === "go" ? "on" : "off";
    } else if (mode === "run") {
      /** @param {any} n */
      const st = (n) => r?.steps[n] || {};
      const build = st("build"), repo = st("repo"), rel = st("release"), live = st("live");
      // out of touch, nothing is drawn as under way: a step it last saw is paused, not spinning (Astra on 447edb6)
      img = build.state === "failed" || repo.state === "failed" ? "failed" : build.state === "done" ? "ready" : r.lost ? (build.state || repo.state ? "paused" : "todo") : build.state === "doing" || repo.state === "doing" || repo.state === "done" ? "building" : "todo";
      const logs = build.url ? ` · <a class="lp-ln" href="${esc(build.url)}" target="_blank" rel="noopener">Logs</a>` : "";
      /** @param {any} t */
      const said = (t) => t && r.error && (t === r.error.text || t === r.error.message); // the headline says it already
      imgText = build.state === "doing" ? `On GitHub Actions${logs}` : build.state === "paused" ? `Was building when XO lost touch${logs}` : build.state ? `${said(build.text) ? "Didn't build" : esc(build.text || "")}${logs}` : repo.text ? (said(repo.text) ? "Didn't push" : esc(repo.text)) : "";
      imgAt = build.state === "doing" ? build.at : repo.state === "doing" ? repo.at : 0;
      inst = rel.state === "failed" ? "failing" : rel.state === "done" ? "ready" : rel.state === "doing" ? "starting" : rel.state === "paused" ? "paused" : "none";
      instWord = /** @type {Record<string, string>} */ ({ failing: "Not ready", ready: "Serving", starting: "Starting", paused: "Paused", none: "Waits for the image" })[inst];
      instText = rel.state === "failed" ? (said(rel.text) ? "" : esc(rel.text || "")) : rel.of ? `${rel.ready} of ${rel.of} ready` : "";
      instAt = rel.state === "doing" ? rel.at : 0;
      addr = live.state === "done" ? "on" : c.app ? "on" : "off"; // an app already live keeps serving while the new release rolls out
    }
    const gh = !c.github ? "" : !c.github.connected ? "GitHub isn't connected" : !c.github.workflow ? "GitHub needs the workflow permission" : "";
    if (mode === "preview" && gh) img = "need";
    const release = r?.release || app?.release || c.app?.release;
    const commit = (r?.live?.commit || c.app?.commit || "");
    const at = app?.at || c.app?.at;
    const ready = r?.steps?.release?.ready ?? c.app?.ready, of = r?.steps?.release?.of ?? c.app?.of;
    /** @param {any} t */
    const clock = (t) => (t ? `<span class="lp-tm">${since(t)}</span>` : "");
    /** @param {any} x */
    const light = (x) => (x === "starting" || x === "building" ? '<i class="lp-arc" aria-hidden="true"></i>' : `<i class="lpv-light ${x}" aria-hidden="true"></i>`);
    /** @param {string} cls */
    const line = (cls) => `<span class="lpv-link ${cls}" aria-hidden="true"></span>`;
    const on = addr === "on";
    // the nodes
    const visitors = `<div class="lpv-vis"><span class="lpv-orb${on ? " on" : ""}">${ICON.globe}</span><span class="lpv-cap">Visitors</span></div>`;
    const address = `<div class="lpv-card lpv-addr ${mode === "preview" ? "plan" : on ? "on" : "off"}">` +
      `<div class="lpv-h">${LP_ICON.link}<span>Address</span>${real ? `<span class="lpv-acts"><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button><a class="lp-ib" href="${esc(app.url)}" target="_blank" rel="noopener" title="Open it" aria-label="Open it">${LP_ICON.out}</a></span>` : ""}</div>` +
      `<div class="lpv-host">${real ? `<b>${esc(mine)}</b><span>${esc(domain)}</span>` : `<b>Launchpad's</b><span>given when it's created</span>`}</div>` +
      `<div class="lpv-tags"><span class="lpv-tag">HTTPS</span></div></div>`;
    const instance = `<div class="lpv-card lpv-inst ${inst}">` +
      `<div class="lpv-top">${light(inst)}<b>${name}</b><span class="lpv-st ${inst}">${esc(instWord)}</span></div>` +
      `<div class="lpv-facts">${mode === "preview" ? `<span>1 instance</span><span>port ${esc(port)}</span>` : `${release ? `<span>Release #${release}</span>` : ""}${of ? `<span>${ready} of ${of} ready</span>` : ""}${instText && !of ? `<span>${instText}</span>` : ""}<span>port ${esc(port)}</span>${clock(instAt)}`}</div></div>`;
    const repoLine = admin ? `${esc(c.repo.full)} · ${esc(c.repo.branch || "main")}` : `<span title="You're not an admin on ${esc(c.repo.full)}, so Launchpad can't add its build there">a private copy in your GitHub</span> <span class="lp-new">new</span>`;
    const image = `<div class="lpv-card lpv-img ${img}">` +
      `<div class="lpv-h">${LP_ICON.image}<span>Image</span>${clock(imgAt)}</div>` +
      (mode === "live" && release ? `<div class="lpv-rel">Release #${release}</div><div class="lpv-meta">${commit ? `<code>${esc(commit)}</code>` : ""}<span>GitHub build${at ? ` · ${ago(at)}` : ""}</span></div>`
        : `<div class="lpv-rel">${mode === "preview" ? "Built by GitHub Actions" : { ready: "Built", failed: "Didn't build", building: r?.steps?.build?.state ? "Building" : "Pushing to GitHub", paused: "Paused", todo: "Waits for the push" }[img] || ""}</div>` +
          (mode !== "preview" && imgText ? `<div class="lpv-meta">${imgText}</div>` : "")) +
      `<div class="lpv-meta">${img === "need" ? `<span class="lpv-need">${gh}</span>` : `<span>from ${repoLine}</span>`}</div></div>`;
    const fed = img === "failed" ? "err" : inst === "starting" || img === "building" ? "flow" : img === "ready" && (inst === "ready" || inst === "starting") ? "feed" : "ghost";
    const toAddr = on ? "ok" : "ghost", toApp = on && inst === "ready" ? "ok" : inst === "failing" ? "err" : "ghost";
    /** In the panel, the same system as one row of four small lit nodes, what matters under it. @param {any} st @param {string} icon @param {string} label @param {string} title */
    const node = (st, icon, label, title, cls = "") => `<span class="lpm-n ${st}${cls}" title="${esc(title)}"><i class="lpm-t">${icon}${st === "starting" || st === "building" ? '<i class="arc"></i>' : ""}</i><b>${label}</b></span>`;
    /** @param {string} cls */
    const mline = (cls) => `<span class="lpm-l ${cls}" aria-hidden="true"></span>`;
    const appTitle = `${f.name || c.app?.name || nameOf(p)}: ${instWord}`;
    const detail = mode === "live" && real
      ? `<div class="lpm-addr${addr === "on" ? "" : " is-off"}"><a class="lpm-host" href="${esc(app.url)}" target="_blank" rel="noopener" title="Open ${esc(real)}"><b>${esc(mine)}</b><span>${esc(domain)}</span></a><button type="button" class="lp-ib" data-lp="copy" title="${s.copied > Date.now() ? "Copied" : "Copy the address"}" aria-label="Copy the address">${s.copied > Date.now() ? ICON.check : ICON.copy}</button><a class="lp-ib" href="${esc(app.url)}" target="_blank" rel="noopener" title="Open it" aria-label="Open it">${LP_ICON.out}</a></div>` +
        `<p class="lpm-meta"><span class="lpm-k">Release</span>${release ? `<span>#${release}</span>` : ""}${commit ? `<code>${esc(commit)}</code>` : ""}<span>built${at ? ` ${ago(at)}` : " on GitHub"}</span>${of && inst !== "ready" ? `<span>${ready} of ${of} ready</span>` : ""}</p>`
      : mode === "preview"
        ? `<p class="lpm-meta"><span class="lpm-k">Image</span>${img === "need" ? `<span class="lpv-need">${gh}</span>` : `<span>from ${repoLine}</span>`}</p>`
        : inst === "starting" || inst === "failing" ? `<p class="lpm-meta"><span class="lpm-k">${name}</span><span>${esc(instWord)}</span>${of ? `<span>${ready} of ${of} ready</span>` : instText ? `<span>${instText}</span>` : ""}${clock(instAt)}</p>`
        : imgText || imgAt ? `<p class="lpm-meta"><span class="lpm-k">Image</span><span>${imgText}</span>${clock(imgAt)}</p>` : "";
    const mini = `<div class="lpm" data-mode="${mode}" role="img" aria-label="${esc(`${nameOf(p)}: visitors, its address, the app (${instWord}), the image`)}"><div class="lpm-row">` +
      node(on ? "on" : mode === "preview" ? "plan" : "off", ICON.globe, "Visitors", "Visitors") + mline(toAddr) +
      node(mode === "preview" ? "plan" : on ? "on" : "off", LP_ICON.link, "Address", real || "Its address on Launchpad") + mline(toApp) +
      node(inst, LP_ICON.app, name, appTitle, " lpm-app") + mline(fed) +
      node(img, LP_ICON.image, "Image", img === "need" ? gh : "The image GitHub Actions builds") + `</div>${detail}</div>`;
    // full size: the demo's own cards, side by side
    const cards = `<div class="lpv" data-mode="${mode}" role="img" aria-label="${esc(`How ${nameOf(p)} runs: visitors, its address, the app, the image`)}">` +
      visitors + line(toAddr) + address + line(toApp) + instance + line(fed) + image + `</div>`;
    // the environment (names set, never values) and the machine; Change hangs off the last of them, so an app with only a disk can still grow it
    const hasEnv = !!(mode === "live" && real && c.env?.length), change = `<button type="button" class="lp-a" data-lp="edit">Change</button>`;
    const ca = c.app, machine = mode === "live" && real && ca && (ca.size || ca.sizeLabel) ? `<p class="lpm-meta lpm-env"><span class="lpm-k">Machine</span><span class="lpm-v"><span>${esc(sizeText(c, ca.size, ca.sizeLabel))}</span>${ca.storage ? `<span>${esc(String(ca.storage.gb))} GB disk at <code>${esc(ca.storage.path)}</code></span>` : ""}</span>${hasEnv ? "" : change}</p>` : "";
    const env = machine + (hasEnv ? `<p class="lpm-meta lpm-env"><span class="lpm-k">Environment</span><span class="lpm-v"><span>${c.env.filter((/** @type {any} */ x) => x.set).length} of ${c.env.length} set</span></span><button type="button" class="lp-a" data-lp="edit">Change</button></p>` : "");
    return mini + cards + env;
  }
  return system;
}
