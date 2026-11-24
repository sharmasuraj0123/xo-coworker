// @ts-check

// Settings › Rules: what agents may do without asking, each rule made by you and revoked here.

import { api } from "../../core/platform/api.js";
import { esc } from "../../core/platform/util.js";
import { renderInline } from "../../core/ui/markdown/markdown.js";
import { isPending, busyAttrs } from "../../core/platform/index.js";

/** @param {import("./types").SettingsHost} host @param {Omit<import("./types").PageDeps, "onChange">} deps */
export function createRulesPage(host, { world, announce, PROJ }) {
  const { R, paint, focusTo, pend, neighbour, sel, errHtml, waits, when } = host;

  async function loadRules() {
    try {
      let after = 0; const rules = []; let defaults = /** @type {any[]} */ ([]);
      for (let i = 0; i < 10; i++) {
        const d = await api.rules({ after_seq: after, limit: 500 });
        rules.push(...(d.rules || [])); defaults = d.defaults || defaults;
        if (!d.next_after_seq) break;
        after = d.next_after_seq;
      }
      R.rules = rules; R.defaults = defaults; R.err.rules = null;
    } catch (/** @type {any} */ err) { R.err.rules = err.message; }
    renderRules();
  }
  const renderRules = () => paint("rules", rulesHtml());
  function rulesHtml() {
    if (R.err.rules && !R.rules) return `<p class="set-empty"><b>Couldn't read your rules.</b> ${esc(R.err.rules)}</p>`;
    if (!R.rules) return `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading…</p>`;
    /** @param {any} r */
    const scopeWord = (r) => {
      if (r.scope === "thread") { const t = r.thread_ts && world.thread(r.thread_ts); return t ? `Only in “${t.title}”` : "Only in one thread"; }
      return r.scope === "project" ? (r.project_pid ? PROJ(projectOfPid(r.project_pid)) : "A project") : "Every project";
    };
    /** @param {any} r @param {boolean} def */
    const row = (r, def) => `<li class="rl-row${r.effect === "deny" ? " is-deny" : ""}" data-key="rule:${esc(r.id)}"><div class="rl-main"><q class="rl-s">${renderInline(r.sentence || "", true)}</q>` +
      `<span class="rl-m">${def ? "XO's default" : `${esc(scopeWord(r))}${r.tier ? ` · ${esc(r.tier)}` : ""}${r.uses ? ` · answered ${r.uses} ${r.uses === 1 ? "ask" : "asks"}` : ""}${r.created_at ? ` · since ${esc(when(r.created_at))}` : ""}`}</span>` +
      (R.err.rule && R.err.rule.id === r.id ? errHtml(R.err.rule.text) : "") + `</div>` +
      (R.confirm && R.confirm.rule === r.id
        ? `<span class="rl-c"><span>${def ? "A default can't be brought back." : "Agents will ask again."}</span><button type="button" class="btn" data-rule-no${waits(`rule:${r.id}`)}>Keep</button><button type="button" class="btn btn-danger" data-rule-yes="${esc(r.id)}"${busyAttrs(`rule:${r.id}`)}>Revoke</button></span>`
        : `<button type="button" class="btn" data-rule-off="${esc(r.id)}">Revoke</button>`) + `</li>`;
    const mine = R.rules.filter((r) => !r.revoked_at);
    const defs = R.defaults.filter((d) => !d.revoked_at);
    const gone = R.defaults.filter((d) => d.revoked_at);
    return `<p class="set-lead">What agents may do without asking you. A rule is only ever made by you: from a decision ("Make it a rule"), word for word. Revoke one and agents ask again.</p>` +
      `<section class="set-sec" aria-labelledby="rl-mine"><h3 id="rl-mine">Your rules <span>${mine.length}</span></h3>${mine.length ? `<ul class="rl-list">${mine.map((r) => row(r, false)).join("")}</ul>` : `<p class="set-note">None yet. When you allow something with "Make it a rule", it appears here.</p>`}</section>` +
      `<section class="set-sec" aria-labelledby="rl-def"><h3 id="rl-def">XO's defaults <span>${defs.length}</span></h3><p class="set-lead">Safe, routine things: reading inside the project, read-only git, XO's own tools.</p><ul class="rl-list">${defs.map((d) => row(d, true)).join("")}</ul>` +
        (gone.length ? `<h4 class="rl-gone-h">Revoked</h4><ul class="rl-list is-gone">${gone.map((d) => `<li class="rl-row is-revoked" data-key="gone:${esc(d.id)}"><div class="rl-main"><q class="rl-s">${renderInline(d.sentence || "", true)}</q><span class="rl-m">Revoked${d.revoked_at ? ` ${esc(when(d.revoked_at))}` : ""} · agents ask for this</span></div></li>`).join("")}</ul>` : "") + `</section>`;
  }
  /** @param {string} pid */
  const projectOfPid = (pid) => (world.state.projects.find((/** @type {any} */ p) => p.id === pid || p.pid === pid) || {}).id || pid;
  /** @param {string} id @param {Element | null} from */
  async function revoke(id, from) {
    const next = neighbour(from, ".rl-row", "data-rule-off");
    if (!isPending(`rule:${id}`)) R.err.rule = null;
    await pend(`rule:${id}`, "rules", renderRules, async () => {
      try { await api.revokeRule(id); }
      catch (/** @type {any} */ err) { R.err.rule = { id, text: err.message }; return {}; }
      // revoked: it leaves its list now (the keyboard to the next rule's Revoke); the read after brings the server's own record
      const at = new Date().toISOString();
      for (const r of [.../** @type {any[]} */ (R.rules), ...R.defaults]) if (r.id === id) r.revoked_at = r.revoked_at || at;
      R.confirm = null;
      announce("Revoked. Agents will ask again.");
      loadRules();
      return { to: next && sel("data-rule-off", next) };
    }, from);
  }

  return {
    open: loadRules,
    /** @param {any} t @returns {boolean} */
    click(t) {
      const ro = t.closest("[data-rule-off]");
      if (ro) { R.confirm = { rule: ro.dataset.ruleOff }; R.err.rule = null; renderRules(); focusTo("rules", "[data-rule-no]"); return true; }
      if (t.closest("[data-rule-no]")) { const id = R.confirm && R.confirm.rule; R.confirm = null; R.err.rule = null; renderRules(); focusTo("rules", id && sel("data-rule-off", id)); return true; }
      const ry = t.closest("[data-rule-yes]");
      if (ry) { revoke(ry.dataset.ruleYes, ry); return true; }
      return false;
    },
  };
}
