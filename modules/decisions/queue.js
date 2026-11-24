// @ts-check

import { VERB } from "../../core/services/review.js";
import * as Kit from "./kit.js";

/** @import { DecisionQueueDeps, DecisionPart, DecisionFailure, DecisionResult, DecisionItem, DecisionBody } from "./queue-types.d.ts" */

/** @param {DecisionQueueDeps} options */
export function createDecisionQueue({ world, F, log, sentKeys, stoppedDone, noSecret, show, toastRender, announce, render, onUndone, onSent, onNotSent }) {
  /** @param {DecisionPart} part @param {DecisionFailure} err */
  const ownDecision = (part, err) => {
    const k = part.choice && part.choice.body && part.choice.body.idempotency_key;
    return !!k && !!(err.item && err.item.decision && err.item.decision.idempotency_key === k);
  };
  /** @param {string | undefined} t */
  const stop = (t) => { t = String(t || "").trim(); return /[.?!…]$/.test(t) ? t : `${t}.`; };
  /** @param {DecisionFailure} err */
  function goneWhy(err) {
    const d = err.item && err.item.decision && err.item.decision.decision;
    if (err.gone === "already_decided" || err.gone === "decided") return `It was already decided elsewhere${d && VERB[d] ? ` (${VERB[d].toLowerCase()})` : ""}.`;
    if (err.gone === "withdrawn") return "It was withdrawn before your answer arrived.";
    if (err.gone === "expired") return "It had expired, and the agent was told.";
    return "It's no longer waiting for you.";
  }
  /** @param {DecisionFailure | undefined} err */
  function failShort(err) {
    if (err && err.code === "secret_needs_a_call") return "XO can't carry a secret here. Give it outside XO, then tell the thread.";
    if (err && err.code === "rule_sentence_mismatch") return "The rule's wording changed. It's back in your list.";
    if (err && err.status >= 400 && err.status < 500 && err.message) return `${stop(err.message)} It's back in your list.`;
    return "It didn't reach the agent. It's back in your list.";
  }
  /** @param {DecisionPart} part @param {DecisionFailure | undefined} err */
  function failLine(part, err) {
    const t = stop(part.ask.title);
    if (err && err.code === "secret_needs_a_call") return `Not sent: ${t} XO can't pass a secret to this question. Don't paste it into the thread: give it to the agent outside XO, then tell the thread it's done.`;
    if (err && err.code === "rule_sentence_mismatch") return `Not sent: ${t} The rule's wording has changed; read it again and decide. It's back in your list.`;
    if (err && err.status >= 400 && err.status < 500 && err.message) return `Not sent: ${t} ${stop(err.message)} It's back in your list.`;
    return `Didn't reach the agent: ${t} It's back in your list.`;
  }

  return Kit.createCommitQueue({
    exec: (/** @type {DecisionPart} */ p) => Promise.resolve(p.choice && p.choice.resolve ? world.act.resolve(p.t.id, true) : p.stopped ? world.act.reply(p.t.id, p.choice.text) : p.choice && p.choice.storm ? world.act.decideItem((/** @type {DecisionItem} */ (p.ask.item)).id, (/** @type {DecisionBody} */ (p.choice.body))) : Kit.answer(world, p.t, p.ask, p.choice, p.note)).then(() => {
      if (p.t.state === "working" && p.t.asks.length) { p.t.asks = []; p.t.needsYou = ""; }
    }),
    onChange(type, item, results) {
      if (type === "undone") {
        for (const p of /** @type {DecisionPart[]} */ (item.parts)) { const i = log.indexOf(p.entry); if (i >= 0) log.splice(i, 1); F.status.delete(p.key); }
        announce("Undone. Nothing was sent; the ask is back.");
        if (F.open) {
          const p = /** @type {DecisionPart} */ (item.parts[0]);
          clearTimeout(F.autoT);
          F.done = false; F.cur = p.key; F.items.set(p.key, p.n);
          if (!F.order.includes(p.key)) F.order.unshift(p.key);
          show(F.cur, "undo");
        }
        onUndone && onUndone(item.parts[0].key);
      }
      if (type === "sending") for (const p of /** @type {DecisionPart[]} */ (item.parts)) p.entry.status = "sending";
      if (type === "settled") {
        for (const { part, ok, err } of /** @type {DecisionResult[]} */ (results)) {
          if (ok) {
            part.entry.status = "sent";
            if (part.stopped) stoppedDone.add(part.t.id); else sentKeys.set(part.key, Date.now());
            onSent && onSent(part);
          } else if (err && err.gone && ownDecision(part, err)) {
            part.entry.status = "sent";
            sentKeys.set(part.key, Date.now());
            onSent && onSent(part);
          } else if (err && err.gone) {
            part.entry.status = "gone";
            part.entry.why = goneWhy(err);
            sentKeys.set(part.key, Date.now());
            announce(`Not sent: ${stop(part.ask.title)} ${part.entry.why}`);
            onNotSent && onNotSent(part.ask.title, part.entry.why);
          } else {
            part.entry.status = "failed";
            F.status.delete(part.key);
            if (err && err.code === "secret_needs_a_call" && part.ask.item) noSecret.add(part.ask.item.id);
            if (part.choice && part.choice.resolve) {
              announce(`Couldn't resolve ${part.t.title}: ${err && err.message ? stop(err.message) : "XO didn't answer."} It's back in your list.`);
              onNotSent && onNotSent(`Couldn't resolve ${part.t.title}`, `${err && err.message ? stop(err.message) : "XO didn't answer."} It's back in your list.`);
              continue;
            }
            announce(failLine(part, err));
            onNotSent && onNotSent(part.ask.title, failShort(err));
          }
        }
      }
      toastRender();
      render();
    },
  });
}
