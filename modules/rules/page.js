// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { ruleApi } from "../../core/platform/api.js";
import { isPending, busyAttrs, esc } from "../../core/platform/index.js";
import { latest } from "../../core/platform/latest.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { renderInline } from "../../core/ui/markdown/markdown.js";

/** @import {Rule, RuleBatch, RulesHost, RulesOptions, RulesState} from "./types" */

const PAGE = "rules";
const PAGE_SIZE = 500;
const MAX_PAGES = 10;

/** @param {AbortSignal} signal */
async function readRules(signal) {
  /** @type {Rule[]} */
  const rules = [];
  /** @type {Rule[]} */
  let defaults = [];
  let after = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    /** @type {RuleBatch | null} */
    const batch = await ruleApi.rules({ after_seq: after, limit: PAGE_SIZE }, signal);
    rules.push(...(batch?.rules ?? []));
    defaults = batch?.defaults ?? defaults;
    if (!batch?.next_after_seq) break;
    after = batch.next_after_seq;
  }
  return { rules, defaults };
}

/** @param {Rule} rule @param {RulesOptions} options */
function scopeWord(rule, { world, PROJ }) {
  if (rule.scope === "thread") {
    const thread = rule.thread_ts && world.thread(rule.thread_ts);
    return thread ? `Only in “${thread.title}”` : "Only in one thread";
  }
  if (rule.scope !== "project") return "Every project";
  const pid = rule.project_pid;
  if (!pid) return "A project";
  const project = world.state.projects.find((item) => item.id === pid || item.pid === pid);
  return PROJ(project?.id || pid);
}

/** @param {Rule} rule @param {boolean} isDefault @param {RulesState} state @param {RulesHost} host @param {RulesOptions} options */
function ruleRow(rule, isDefault, state, host, options) {
  const key = `rule:${rule.id}`;
  const tier = rule.tier ? ` · ${esc(rule.tier)}` : "";
  const used = rule.uses ? ` · answered ${rule.uses} ${rule.uses === 1 ? "ask" : "asks"}` : "";
  const date = rule.created_at ? ` · since ${esc(host.when(rule.created_at))}` : "";
  const scope = isDefault ? "XO's default" : esc(scopeWord(rule, options)) + tier + used + date;
  const error = state.revokeError?.id === rule.id ? host.errHtml(state.revokeError.text) : "";
  const question = isDefault ? "A default can't be brought back." : "Agents will ask again.";
  const controls = state.confirmation === rule.id
    ? `<span class="rl-c"><span>${question}</span><button type="button" class="btn" data-rule-no${host.waits(key)}>Keep</button>`
      + `<button type="button" class="btn btn-danger" data-rule-yes="${esc(rule.id)}"${busyAttrs(key)}>Revoke</button></span>`
    : `<button type="button" class="btn" data-rule-off="${esc(rule.id)}">Revoke</button>`;
  return `<li class="rl-row${rule.effect === "deny" ? " is-deny" : ""}" data-key="${esc(key)}"><div class="rl-main">`
    + `<q class="rl-s">${renderInline(rule.sentence || "", true)}</q><span class="rl-m">${scope}</span>${error}</div>${controls}</li>`;
}

/** @param {RulesState} state @param {RulesHost} host @param {RulesOptions} options */
function rulesHtml(state, host, options) {
  if (state.listError && !state.rules) {
    return `<p class="set-empty"><b>Couldn't read your rules.</b> ${esc(state.listError)}</p>`;
  }
  if (!state.rules) return '<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>';
  const mine = state.rules.filter((rule) => !rule.revoked_at);
  const defaults = state.defaults.filter((rule) => !rule.revoked_at);
  const gone = state.defaults.filter((rule) => rule.revoked_at);
  const myRows = mine.map((rule) => ruleRow(rule, false, state, host, options)).join("");
  const defaultRows = defaults.map((rule) => ruleRow(rule, true, state, host, options)).join("");
  const goneRows = gone.map((rule) => {
    const date = rule.revoked_at ? ` ${esc(host.when(rule.revoked_at))}` : "";
    return `<li class="rl-row is-revoked" data-key="gone:${esc(rule.id)}"><div class="rl-main">`
      + `<q class="rl-s">${renderInline(rule.sentence || "", true)}</q>`
      + `<span class="rl-m">Revoked${date} · agents ask for this</span></div></li>`;
  }).join("");
  const intro = '<p class="set-lead">What agents may do without asking you. A rule is only ever made by you: from a decision '
    + '("Make it a rule"), word for word. Revoke one and agents ask again.</p>';
  const empty = '<p class="set-note">None yet. When you allow something with "Make it a rule", it appears here.</p>';
  const yours = `<section class="set-sec" aria-labelledby="rl-mine"><h3 id="rl-mine">Your rules <span>${mine.length}</span></h3>`
    + (myRows ? `<ul class="rl-list">${myRows}</ul>` : empty) + '</section>';
  const builtIn = `<section class="set-sec" aria-labelledby="rl-def"><h3 id="rl-def">XO's defaults`
    + ` <span>${defaults.length}</span></h3>`
    + '<p class="set-lead">Safe, routine things: reading inside the project, read-only git, XO\'s own tools.</p>'
    + `<ul class="rl-list">${defaultRows}</ul>`
    + (goneRows ? `<h4 class="rl-gone-h">Revoked</h4><ul class="rl-list is-gone">${goneRows}</ul>` : "")
    + '</section>';
  return intro + yours + builtIn;
}

/** @param {RulesHost} host @param {RulesOptions} options */
export function createRulesPage(host, options) {
  const scope = createScope();
  const requestKey = Symbol(PAGE);
  /** @type {RulesState} */
  const state = { rules: null, defaults: [], listError: null, revokeError: null, confirmation: null };

  function render() {
    if (!scope.signal.aborted) host.paint(PAGE, rulesHtml(state, host, options));
  }

  async function loadRules() {
    try {
      await latest(requestKey, readRules, {
        signal: scope.signal,
        commit({ rules, defaults }) {
          state.rules = rules;
          state.defaults = defaults;
          state.listError = null;
          render();
        },
      });
    } catch (error) {
      if (scope.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
      state.listError = requestFailureMessage(error, "Couldn't read your rules.");
      render();
    }
  }

  /** @param {string} id @param {Element} from */
  async function revoke(id, from) {
    const key = `rule:${id}`;
    const next = host.neighbour(from, ".rl-row", "data-rule-off");
    if (!isPending(key)) state.revokeError = null;
    await host.pend(key, PAGE, render, async () => {
      try {
        await ruleApi.revokeRule(id, scope.signal);
      } catch (error) {
        if (scope.signal.aborted) return;
        state.revokeError = { id, text: requestFailureMessage(error, "Couldn't revoke the rule.") };
        return {};
      }
      if (scope.signal.aborted) return;
      const at = new Date().toISOString();
      for (const rule of [...(state.rules ?? []), ...state.defaults]) {
        if (rule.id === id) rule.revoked_at ||= at;
      }
      state.confirmation = null;
      options.announce("Revoked. Agents will ask again.");
      void loadRules();
      return { to: next && host.sel("data-rule-off", next) };
    }, from);
  }

  return {
    open: loadRules,
    dispose: scope.dispose,
    /** @param {Element} target */
    click(target) {
      if (scope.signal.aborted) return false;
      const id = target.closest("[data-rule-off]")?.getAttribute("data-rule-off");
      if (id) {
        state.confirmation = id;
        state.revokeError = null;
        render();
        host.focusTo(PAGE, "[data-rule-no]");
        return true;
      }
      if (target.closest("[data-rule-no]")) {
        const previous = state.confirmation;
        state.confirmation = null;
        state.revokeError = null;
        render();
        host.focusTo(PAGE, previous && host.sel("data-rule-off", previous));
        return true;
      }
      const yes = target.closest("[data-rule-yes]");
      const confirmed = yes?.getAttribute("data-rule-yes");
      if (yes && confirmed) {
        void revoke(confirmed, yes);
        return true;
      }
      return false;
    },
  };
}
