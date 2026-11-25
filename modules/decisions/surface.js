// @ts-check
import { decisionGesture, sheetGesture } from "../../shell/gestures.js";
import { PHONE } from "../../core/platform/viewport.js";
import { requireHtml } from "../../core/platform/dom.js";
import { ownLayer } from "../../shell/layers.js";
import { mountDecisionDock } from "./dock-surface.js";
import { createScope } from "../../core/kernel/scope.js";

import { createDecisionPings } from "../../shell/decision-pings.js";
import { convOfChat } from "../../shell/place-context.js";
import * as Kit from "./kit.js";
import { EFFORT, evidenceFor } from "./rank.js";
import { askTitle, askShort } from "./ask-label.js";
import { createDecisions } from "./controller.js";
import { createDecisionFeedback } from "./feedback.js";
import { createPacing } from "./pacing.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const decisionModule = {
  manifest: { id: "xo.decision-model", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["edgeCards", "world", "navigation", "projectName", "currentView", "announce", "notices", "redrawFocus", "conversationSession"],
    contributes: ["workspace.paint:decisions"], provides: ["decisionPresentation"] },
  activate(ctx) {
    const world = ctx.use("world"), { go } = ctx.use("navigation"), PROJ = ctx.use("projectName");
    const showNotice = ctx.use("notices").show, view = ctx.use("currentView");
    const focus = ctx.use("redrawFocus"), session = ctx.use("conversationSession");
    const render = () => ctx.invalidate("workspace");
    const pacing = createPacing();
    const waitSince = new Map();
    const decisions = createDecisions({
      world, PROJ, announce: ctx.use("announce"), render, back: (targets) => focus.back(targets, session.region, render),
      onShown: () => ctx.emit("app:card-opened", "decisions"), onGone: () => ctx.emit("app:card-closed", "decisions"),
      ...createDecisionFeedback(showNotice, ctx),
      P: pacing, waitSince, onUndone: (key) => ctx.emit("app:decision-undone", key),
      onOpenThread(id) {
        const host = world.state.hosts?.find((entry) => entry.id === id);
        if (!host) go("t:" + id);
        else if (host.chatId) go(convOfChat(host.project));
        else if (host.plainSession) go("c:" + host.plainSession);
        else showNotice({ kind: "calm", text: "It isn't tied to a conversation", sub: host.title }, 3600);
      },
    });
    /** @type {Parameters<typeof createDecisionPings<import("./controller-types").DecisionNeed>>[0]} */
    const pingOptions = { view, P: pacing, PROJ, askShort, heraldShow: showNotice };
    ctx.effect(() => ctx.use("edgeCards").register("decisions", decisions));
    /** @type {import("./surface-types").DecisionPresentation} */
    const presentation = { D: decisions, pings: createDecisionPings(pingOptions),
      EFFORT, askTitle, askShort, waitSince, Kit, evidenceFor };
    ctx.contribute("workspace.paint", { id: "decisions", order: 50, paint: decisions.sync });
    decisionGesture(ctx, decisions.isOpen);
    sheetGesture(ctx, { host: requireHtml("#panel"), open: () => !!PHONE?.matches && decisions.isOpen(), close: () => decisions.close() });
    ownLayer(ctx, { id: "decisions", open: decisions.isOpen, close: () => { decisions.close(); } });
    ctx.provide("decisionPresentation", presentation);
  },
};

/** @type {import("../../core/kernel/types").ModuleDef} */
export const decisionDockModule = {
  manifest: { id: "xo.decisions", version: "1.0.0", kernel: "^1.1.0", core: true,
    needs: ["chats", "decisionPresentation", "world", "placeContext", "messageContext", "currentView", "conversationSession", "announce"],
    provides: ["decisionDock"], contributes: ["workspace.paint:decision-dock", "conversation.press:decide", "conversation.press:limit"] },
  activate(ctx) {
    const scope = createScope();
    ctx.effect(() => scope.dispose);
    const dock = mountDecisionDock({
      scope, CH: ctx.use("chats"), D: ctx.use("decisionPresentation").D, world: ctx.use("world"),
      convThread: ctx.use("placeContext").convThread, convHost: ctx.use("messageContext").convHost, on: ctx.on,
      schedule: () => ctx.invalidate("workspace"), view: ctx.use("currentView"), region: ctx.use("conversationSession").region,
      announce: ctx.use("announce"),
    });
    for (const route of dock.routes) ctx.contribute("conversation.press", route);
    ctx.on("app:view-visited", () => dock.main.reset({ restoreFocus: false }));
    ctx.contribute("workspace.paint", { id: "decision-dock", order: 20, paint: dock.main.render });
    ctx.provide("decisionDock", dock);
  },
};
