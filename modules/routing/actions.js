// @ts-check

import { api } from "../../core/platform/api.js";
import { isPending } from "../../core/platform/index.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { DEFAULT_ABSTAIN, PAGE, ROUTER } from "./constants.js";

/** @import {RoutingActionsView, RoutingHost, RoutingOptions, RoutingState} from "./types" */

/** @param {RoutingState} R @param {RoutingHost} host @param {RoutingOptions} options @param {RoutingActionsView} view */
export function createRoutingActions(R, host, { world, announce, PROJ, onChange }, { render, refreshRouter, write, commit, signal }) {
  const { pend, sel } = host;
  /** @param {string} mode @param {string | null} dm @param {number} [abstain] */
  async function setRoute(mode, dm, abstain) {
    const r = world.state.router || R.router || {};
    if (abstain == null && r.mode === mode && (mode !== "decision" || r.decision_model === dm)) return;
    if (!isPending(ROUTER)) R.err.route = null;
    await pend(ROUTER, PAGE, render, () => write(async () => {
      try {
        const confidence = abstain ?? r.abstain_below ?? DEFAULT_ABSTAIN;
        const decisionModel = mode === "decision" ? { decision_model: dm } : {};
        const router = await api.setRouter({ mode, ...decisionModel, abstain_below: confidence }, { signal });
        if (!commit(() => { R.router = world.state.router = router; })) return;
        const label = R.models.find((m) => m.id === dm)?.label || dm;
        const words = mode === "off" ? "Routing is off."
          : mode === "agent" ? "The coordinator routes new messages." : `${label} routes new messages.`;
        announce(words);
        onChange();
      } catch (error) {
        if (!signal.aborted) R.err.route = requestFailureMessage(error, "Couldn't change the routing.");
      }
    }));
  }
  /** @param {Element} form @param {Element | null} from */
  async function connect(form, from) {
    const id = form.getAttribute("data-dm-form");
    const input = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="key"]'));
    if (!id || !input) return;
    const modelInput = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name="model"]'));
    const key = input.value.trim();
    const model = modelInput?.value.trim();
    if (isPending(`dm-on:${id}`)) return;
    if (!key) {
      R.err.dm = "Paste the key first.";
      render();
      input.focus();
      return;
    }
    R.err.dm = null;
    await pend(`dm-on:${id}`, PAGE, render, () => write(async () => {
      try {
        const reply = await api.connectRouterModel({ provider: id, ...(model ? { model } : {}), api_key: key }, { signal });
        if (!commit(() => { R.models = reply?.models || R.models; })) return;
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof Error && "code" in error && error.code === "invalid_key") {
          R.err.dm = "That doesn't look like a key: no spaces, not blank.";
          input.value = "";
          return { to: `${sel("data-dm-form", id)} input[name="key"]` };
        }
        R.err.dm = requestFailureMessage(error, "Couldn't connect the decision model.");
        return {};
      }
      announce("Connected. Its key is saved and won't be shown again.");
      onChange();
      if (R.form === id) R.form = null;
      return { to: sel("data-dm-off", id) };
    }), from);
  }
  /** @param {string} id @param {Element | null} from */
  async function disconnect(id, from) {
    R.err.dmOff = null;
    const chats = R.confirm?.dm === id ? R.confirm.chats : [];
    await pend(`dm-off:${id}`, PAGE, render, () => write(async () => {
      const currentRouter = world.state.router;
      try {
        const reply = await api.disconnectRouterModel(id, { signal });
        if (!commit(() => { R.models = reply?.models || R.models; })) return;
      } catch (error) {
        if (signal.aborted) return;
        R.err.dmOff = requestFailureMessage(error, "Couldn't disconnect the decision model.");
        return {};
      }
      const left = [];
      for (const c of chats) {
        const p = world.project(c);
        if (!p) continue;
        try {
          const reply = await api.patchChat(p.chatId, { routing: null }, { signal });
          if (signal.aborted) return;
          p.routing = reply?.routing || null;
        }
        catch (error) {
          if (signal.aborted) return;
          requestFailureMessage(error, "Couldn't update the chat routing.");
          left.push(PROJ(c));
        }
      }
      await refreshRouter((router) => {
        if (world.state.router === currentRouter) world.state.router = router;
      });
      if (signal.aborted) return;
      const subject = left.length === 1 ? "names it: use the Space's routing for it" : "name it: use the Space's routing for them";
      const reminder = left.length ? ` ${left.join(", ")} still ${subject}.` : "";
      announce(`Disconnected. Its key is removed.${reminder}`);
      onChange();
      if (R.confirm?.dm === id) R.confirm = null;
      return { to: sel("data-dm-on", id) };
    }), from);
  }
  /** @param {string} chat @param {Element | null} from */
  async function clearOverride(chat, from) {
    const next = host.neighbour(from, ".set-row", "data-ov-clear");
    if (!isPending(`ov:${chat}`)) R.err.ov = null;
    await pend(`ov:${chat}`, PAGE, render, () => write(async () => {
      try {
        const c = await api.patchChat(chat, { routing: null }, { signal });
        if (signal.aborted) return;
        const p = world.state.projects.find((item) => item.chatId === chat);
        if (p) p.routing = (c && c.routing) || null;
        announce("It uses the Space's routing again.");
        onChange();
        return { to: next ? sel("data-ov-clear", next) : '[data-route][aria-checked="true"]' };
      } catch (error) {
        if (signal.aborted) return;
        R.err.ov = { chat, text: requestFailureMessage(error, "Couldn't update the chat routing.") };
        return {};
      }
    }), from);
  }
  return { setRoute, connect, disconnect, clearOverride };
}
