// @ts-check

import { esc } from "../../core/platform/util.js";
import * as K from "../../core/platform/keys.js";
import { itemParts, questionsOf } from "../../core/services/review.js";
import { ICON, dial } from "../../core/ui/icons/names.js";
import { inlineText, renderInline } from "../../core/ui/markdown/inline.js";
import * as Kit from "./kit.js";
import { EFFORT, evidenceFor, estLine } from "./rank.js";
import { KINDS, kindOf, commandOf, headOf, whyOf, stripOf, chipsOf, optionsOf, pickKeys, actsOf, isOnePress } from "./cardparts.js";
import { detailsHtml, optHtml, itemDetailsHtml, limitHtml, waitingDetailsHtml, runtimeUsesHtml } from "./cards/evidence.js";
import { sessionThreads } from "../../core/services/runtimes.js";
import { paidHtml } from "./cards/paid.js";

/** @import { CardDeps, CardItem, CardNeed, Action, Option, Question, ScopeParts, Strip } from "./card-types.d.ts" */

/** @import { ItemNeed } from "./cards/evidence-types.d.ts" */

/** @param {ScopeParts} P @param {string | undefined} id */
export const scopeWords = (P, id) => {
  const o = id && P.scopes.find((x) => x.id === id);
  return !o ? (P.primary?.label || "Allow") : o.scope === "thread" ? "Allow for this thread" : "Allow + rule";
};

/** @param {CardNeed} n */
function cardTitle(n) {
  const head = headOf(n);
  return headingText(head, head.md ? inlineText : String).trim();
}

/** @param {ReturnType<typeof headOf>} head @param {(text: string) => string} format @param {(verb: string) => string} [verbFormat] */
function headingText(head, format, verbFormat = String) {
  return (head.verb ? verbFormat(head.verb) + " " : "") + format(head.text);
}

/** @param {CardNeed["ask"]["item"]} it @param {CardDeps["world"]["state"]} state */
function usesHtml(it, state) {
  const ra = it?.detail?.runtime_action;
  if (!ra?.runtime || ra.action !== "uninstall") return "";
  return runtimeUsesHtml(ra.runtime, sessionThreads(it?.detail?.sessions, state));
}

/** @param {CardDeps} options */
export function createDecisionCard({ world, PROJ, F, teach, noSecret }) {
  let cardN = 0;

  /** @param {Action} b @param {CardNeed} n @param {string} [scope] */
  function actHtml(b, n, scope) {
    const it = n.ask.item;
    /** @param {string} cls @param {string} icon @param {string} title @param {string} key */
    const keyed = (cls, icon, title, key) => `<button type="button" class="b ${cls}" data-act="${b.act}" title="${esc(title)}${K.hint(key)}" aria-keyshortcuts="${K.label(key)}"><span class="b-l">${icon}${esc(b.label)}</span></button>`;
    switch (b.act) {
      case "allow": return `<button type="button" class="b b-allow${n.risk === "notable" ? " arming" : ""}" data-act="allow" title="${esc(b.label)}${K.hint("allow")}" aria-keyshortcuts="${K.label("allow")}"><span class="b-l">${ICON.check}<span class="al-t">${esc(it ? scopeWords(itemParts(it), scope) : scope ? "Allow + rule" : b.label)}</span></span></button>`;
      case "hold": return `<button type="button" class="b b-hold" data-act="hold" title="Press and hold for 1.2 s (hold Enter)" aria-label="${esc(b.label)}: ${esc(n.ask.title)}. Press and hold for 1.2 seconds."><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt" data-label="${esc(b.label)}">${esc(b.label)}</span></span></button>`;
      case "submit": return `<button type="submit" class="b b-allow"><span class="b-l">${ICON.check}${esc(b.label)}</span></button>`;
      case "back": return keyed("b-back", ICON.rewind, "Send back with a note", "back");
      case "back-now": return keyed("b-back", ICON.rewind, b.label, "back");
      case "reply": return keyed("b-reply", ICON.edit, "Reply in your words", "reply");
      case "note-reply": return keyed("b-back", ICON.edit, b.label, "reply");
      case "retry": return keyed("b-allow", ICON.retry, b.label, "allow");
      case "done": return keyed("b-done", ICON.check, "It's finished: resolve the thread", "done");
      case "thread": return keyed("b-reply", ICON.arrow, "Open the thread", "open");
      case "later": return keyed("b-ghost b-later", ICON.clock, "Plan for later today", "later");
      default: return "";
    }
  }
  /** @param {Action[]} acts @param {CardNeed} n @param {string} [scope] */
  const rowHtml = (acts, n, scope) => acts.length ? `<div class="c-btns">${acts.map((b) => actHtml(b, n, scope)).join("")}</div>` : "";

  /** @param {Option} o @param {string} tag */
  const optLine = (o, tag) => o.description || o.cost || o.recommended
    ? `<${tag} class="o-d">${o.recommended ? `<span class="o-rec">Suggested · </span>` : ""}${[o.description && esc(o.description), o.cost && `<span class="o-cost">${esc(o.cost)}</span>`].filter(Boolean).join(" · ")}</${tag}>` : "";

  /** @param {CardNeed} n @param {number} id @param {Action[]} acts */
  function questionHtml(n, id, acts) {
    const it = /** @type {CardItem} */ (n.ask.item), qs = /** @type {Question[]} */ (questionsOf(it));
    if (isOnePress(n)) {
      const os = optionsOf(qs[0]), keys = pickKeys(os);
      return `<div class="c-opts is-list" role="group" aria-label="Answers">${os.map((o, i) => `<button type="button" class="b b-opt${o.recommended ? " is-rec" : ""}" data-iopt="${o.index}"${keys[i] ? ` data-pick="${keys[i]}"` : ""} title="Answer “${esc(o.label)}”${keys[i] ? ` (${keys[i]})` : ""}"><span class="o-l">${esc(o.label)}</span>${optLine(o, "span")}</button>`).join("")}</div>` + rowHtml(acts, n);
    }
    return `<form class="c-qs" data-qform novalidate>${qs.map((q, qi) => {
      const name = `q${id}-${qi}`;
      // a lone question that is the card's own title isn't said twice (its label stays for screen readers)
      const same = qs.length === 1 && !q.header && q.question === it.title;
      const head = same ? `<legend class="sr-only">${esc(q.question)}</legend>` : `<legend>${esc(q.header || q.question)}</legend>${q.header && q.question ? `<p class="c-q-q">${esc(q.question)}</p>` : ""}`;
      if (q.secret) return `<fieldset class="c-q">${head}<input type="password" class="c-q-in" name="${name}" data-qid="${esc(q.id)}" autocomplete="off" aria-label="${esc(q.question)}"><p class="c-q-s">Goes to the agent only; XO keeps it as [secret].</p></fieldset>`;
      if (!q.options.length) return `<fieldset class="c-q">${head}<input class="c-q-in" name="${name}" data-qid="${esc(q.id)}" autocomplete="off" aria-label="${esc(q.question)}"></fieldset>`;
      const os = optionsOf(q), keys = qs.length === 1 ? pickKeys(os) : os.map(() => 0);
      return `<fieldset class="c-q">${head}<div class="c-q-opts">${os.map((o, i) => `<label class="c-q-o${o.recommended ? " is-rec" : ""}"><input type="${q.multi ? "checkbox" : "radio"}" name="${name}" data-qid="${esc(q.id)}" value="${esc(o.label)}"${keys[i] ? ` data-pick="${keys[i]}"` : ""}><span><b>${esc(o.label)}</b>${optLine(o, "em")}</span></label>`).join("")}</div></fieldset>`;
    }).join("")}${rowHtml(acts, n)}</form>`;
  }

  /** @param {CardNeed} n */
  function ruleHtml(n) {
    const it = n.ask.item, scope = teach.get(n.key);
    if (it) {
      const P = /** @type {ScopeParts} */ (itemParts(it));
      if (!P.scopes.length) return "";
      const cur = P.scopes.find((o) => o.id === scope) || P.scopes[0];
      return `<div class="c-rule"><button type="button" class="teach-tog" data-act="teach" aria-pressed="${!!scope}" title="Allow more than once${K.hint("rule")}"><span class="sw" aria-hidden="true"></span>${P.scopes.some((o) => o.scope === "rule") ? "Make it a rule" : "Allow for this thread"}</button></div>` +
        `<div class="teach-body"${scope ? "" : " hidden"}><div class="teach-in"><div class="teach-scope is-list" role="radiogroup" aria-label="How far it reaches">${P.scopes.map((o) => `<button type="button" role="radio" data-iscope="${esc(o.id)}" aria-checked="${o.id === (scope || cur.id)}">${esc(o.scope === "thread" ? o.label : (o.sentence || o.label))}</button>`).join("")}</div>` +
        `<p class="teach-q"><span>${cur.scope === "rule" ? "Added to your rules, word for word:" : "For this thread only:"}</span><q>${esc(cur.sentence || cur.label)}</q></p></div></div>`;
    }
    const cmd = commandOf(n.ask);
    if (n.ask.kind !== "permission" || n.risk === "destructive" || !cmd) return "";
    return `<div class="c-rule"><button type="button" class="teach-tog" data-act="teach" aria-pressed="${!!scope}" title="Make it a rule${K.hint("rule")}"><span class="sw" aria-hidden="true"></span>Make it a rule</button></div>` +
      `<div class="teach-body"${scope ? "" : " hidden"}><div class="teach-in"><div class="teach-scope" role="radiogroup" aria-label="Rule scope"><button type="button" role="radio" data-scope="exact" aria-checked="${scope !== "prefix"}">Exactly this command</button><button type="button" role="radio" data-scope="prefix" aria-checked="${scope === "prefix"}">Any “${esc(Kit.prefixOf(cmd))}”</button></div><p class="teach-q"><span>Added to your rules, word for word:</span><q>${esc(Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd))}</q></p></div></div>`;
  }

  /** @param {string} text */
  const codeHtml = (text) => String(text).replace(/[^\s/]*\/+|[^\s/]+|\s+/g, (m) => (/^\s/.test(m) ? m : `<span class="ev-w">${esc(m)}</span>`));

  /** @param {Strip | null} s */
  function stripHtml(s) {
    if (!s) return "";
    const tag = s.tag ? `<span class="ev-tag">${esc(s.tag)}</span>` : "";
    if (s.type === "diff") return `<div class="c-ev is-diff">${s.lines.map((l) => `<code class="${l.sign === "+" ? "dl-add" : "dl-del"}">${esc(l.sign + l.text)}</code>`).join("")}</div>`;
    if (s.type === "plan") return `<div class="c-ev is-plan${s.more ? " is-more" : ""}">${tag}<p class="ev-plan">${esc(s.text.replace(/^#+\s*/gm, ""))}</p></div>`;
    if (s.type === "paths") return `<ul class="c-ev is-paths">${s.items.map((p) => `<li><code>${esc(p.path)}</code>${p.add ? `<span class="dl-add">+${p.add}</span>` : ""}${p.del ? `<span class="dl-del">−${p.del}</span>` : ""}</li>`).join("")}${s.more ? `<li class="ev-more">${s.more} more</li>` : ""}</ul>`;
    if (s.type === "error") return `<p class="c-ev is-error">${esc(s.text)}</p>`;
    if (s.type === "files") return `<ul class="c-ev is-files">${s.items.map((p) => `<li><code>${codeHtml(p)}</code></li>`).join("")}${s.more ? `<li class="ev-more">${s.more} more</li>` : ""}</ul>`;
    return `<p class="c-ev is-mono">${tag}<code>${codeHtml(s.text)}</code></p>`;
  }

  /** @param {CardNeed} n */
  function effTagHtml(n) {
    const E = EFFORT[n.effort];
    const tag = n.risk === "destructive" ? `<span class="risk r-destructive">${ICON.lock}Destructive</span>` : kindOf(n) === "stopped" ? `<span class="risk r-stopped">Stopped</span>` : "";
    return `<span class="eff e-${n.effort}">${dial(n.effort)}<b>${E.label}</b><span>${E.time}</span></span>${tag}`;
  }

  /** @param {CardNeed} n @param {string} idp @param {string} h */
  function leadHtml(n, idp, h) {
    const head = headOf(n), line = whyOf(n), it = n.ask.item;
    const title = headingText(head, head.md ? (text) => renderInline(text, true) : esc, (verb) => `<span class="h-verb">${esc(verb)}</span>`);
    return `<${h} class="c-h" id="${idp}-h">${title}</${h}>` +
      (line ? `<p class="c-line" id="${idp}-why">${esc(line)}</p>` : "") +
      (it && it.parked ? `<p class="c-park">${ICON.pause}<span>Parked: the agent was told to wait; an answer wakes it</span></p>` : "") +
      stripHtml(/** @type {Strip | null} */ (stripOf(n))) + (it && it.limit ? limitHtml(/** @type {import('./cards/evidence-types.d.ts').LimitItem} */ (it)) : paidHtml(it) + usesHtml(it, world.state));
  }

  /** @param {CardNeed} n */
  function chipsHtml(n) {
    const estT = n.risk !== "destructive" ? estLine(n) : "";
    return chipsOf(n).map((c) => `<li class="chip${c.tone ? ` t-${c.tone}` : ""}">${esc(c.text)}${c.count > 1 ? `<b>${c.count}</b>` : ""}</li>`).join("") +
      (estT ? `<li class="chip is-est" title="${n.t.live ? "From its checklist: the steps not done yet." : "An estimate: the steps left that wait on this answer × a typical step time."}">${ICON.hourglass}${esc(estT)}</li>` : "");
  }

  /** @param {CardNeed} n @param {string} [surface] */
  function cardHtml(n, surface = "panel") {
    const id = ++cardN;
    const a = n.ask, t = n.t, it = a.item, kind = kindOf(n);
    const openEv = !!F.open0[n.key]?.ev && surface === "panel";
    const scope = teach.get(n.key);
    const refused = !!(it && kind === "secret" && noSecret.has(it.id));
    const acts = actsOf(n, { canResolve: !!world.act.resolve, refused });

    let act = "";
    if (refused) {
      // XO refused to carry a secret to this question (secret_needs_a_call): it can't be answered here
      act += `<p class="c-iwhy">${ICON.lock}<span>XO can't pass a secret to this question. Don't paste it into the thread: XO keeps what's written there. Give it to the agent outside XO (for example in its environment), then tell the thread it's done; your reply replaces this question.</span></p>` + rowHtml(acts, n);
    } else if (it && KINDS[kind].acts === "answer") {
      act += questionHtml(n, id, acts);
    } else {
      if (!it && Array.isArray(a.options) && a.options.length && KINDS[kind].acts === "answer") {
        const ev = evidenceFor(n);
        act += `<div class="c-opts n${Math.min(a.options.length, 3)}" role="group" aria-label="Answers">${a.options.map((o, i) => optHtml(o, i, ev)).join("")}</div>`;
      }
      if (it && kind === "create_project" && itemParts(it).primary?.answer === "name") act += `<label class="c-name"><span>Project name</span><input class="c-name-in" data-name value="${esc((it.detail && it.detail.name) || "")}" maxlength="80" autocomplete="off"></label>`;
      act += ruleHtml(n);
      const why = it && itemParts(it).why;
      if (why) act += `<p class="c-iwhy">${ICON.lock}<span>${esc(why)}</span></p>`;
      act += rowHtml(acts, n, scope);
    }
    act += `<div class="c-note" hidden><label for="c-note-${id}" class="c-note-l"></label><textarea id="c-note-${id}" class="c-note-in" rows="2"></textarea>` +
      `<div class="c-note-row"><button type="button" class="b b-sm b-go" data-act="note-send"></button><button type="button" class="b b-sm b-ghost" data-act="note-cancel" title="Cancel (Esc)">Cancel</button></div></div>`;

    const where = t.host
      ? `<button type="button" class="c-where" data-act="thread" title="${t.asker ? (surface === "dock" ? `Its coordinator asks, in this chat` : `Open ${esc(PROJ(t.project))}, where its coordinator asks`) : "Open where it was asked"}">${t.asker ? `${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b>` : esc(t.title)}</button>`
      : `<button type="button" class="c-where" data-act="thread" title="${surface === "dock" ? "Open the thread" : `Open the thread beside this${K.hint("open")}`}">${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b></button>`;

    return `<div class="card-in" data-key="${esc(n.key)}">` +
      `<div class="c-body">` +
      `<div class="c-top">${effTagHtml(n)}${where}</div>` +
      leadHtml(n, `card-${id}`, "h3") +
      `<div class="dis${openEv ? " is-open" : ""}" data-dis="ev"><div class="c-chips"><ul class="chips" aria-label="About this">${chipsHtml(n)}</ul><button type="button" class="dis-h" aria-expanded="${openEv}" aria-controls="dt-${id}" title="Details${K.hint("details")}">${ICON.chevron}<span>Details</span></button></div>` +
      `<div class="dis-b" id="dt-${id}"${openEv ? "" : " hidden"}><div class="dis-in">${it ? itemDetailsHtml(/** @type {CardNeed & ItemNeed} */ (n)) : a.live ? waitingDetailsHtml(n) : detailsHtml(n, evidenceFor(n))}</div></div></div>` +
      `</div>` +
      `<div class="c-act">${act}<p class="c-hint" aria-live="polite"></p></div></div>`;
  }

  return { cardHtml, cardTitle, effTagHtml, leadHtml, chipsHtml };
}
