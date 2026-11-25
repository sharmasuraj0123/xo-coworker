// @ts-check
import { createConversationMessages } from "./messages.js";
import { heldWords } from "../../core/services/world/timeline.js";
import { convOfChat } from "../../shell/place-context.js";
import { tickElapsed } from "../../shell/elapsed.js";
import { pressEntry } from "../../shell/conversation-press.js";
import { transcriptActions } from "./transcript-actions.js";
import { createTyping } from "./typing.js";
import { createMessageContext } from "./message-context.js";
import { createMessageDetails } from "./message-details.js";
import { createMessageItems } from "./message-items.js";
import { createConversationDrawing } from "./draw.js";

/** @param {import("./transcript-module-types").TranscriptHost} host */
export function createTranscriptModule(host) {
  /** @type {ReturnType<typeof createConversationDrawing> | undefined} */
  let draw;
  /** @type {ReturnType<typeof createMessageItems> | undefined} */
  let items;
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.transcript", version: "1.0.0", kernel: "^1.1.0",
      needs: ["world", "shape", "placeContext", "decisionPresentation", "threadPresentation", "changeData"],
      contributes: ["conversation.press:older", "conversation.press:fold", "conversation.press:checklist",
        "conversation.press:interrupt"] },
    activate(ctx) {
      const world = ctx.use("world"), shape = ctx.use("shape"), place = ctx.use("placeContext");
      const decision = ctx.use("decisionPresentation"), status = ctx.use("threadPresentation");
      const { changes: CHG } = ctx.use("changeData");
      const messagesOf = createConversationMessages({
        ...place, world, shape, D: decision.D, localMessages: host.localMessages, chatOf: place.convProject });
      const context = createMessageContext({ world, PROJ: place.PROJ });
      const typing = createTyping({
        world, CH: host.CH, PROJ: place.PROJ, convThread: place.convThread, chatOf: place.convProject, isBusy: status.isBusy,
        openAsk: context.openAsk, heldWords, schedule: () => ctx.emit("app:render"), tick: tickElapsed,
        sendingTo(chat) {
          return host.localMessages.list(convOfChat(chat)).find(
            (row) => row.who === "you" && row.status === "sending" && row.target === chat) ?? null;
        },
      }, ctx);
      const details = createMessageDetails({
        ...host, ...place, ...status, ...decision, world, SHAPE: shape, aliases: host.localMessages.aliases });
      items = createMessageItems({ ...host, ...place, ...context, ...details, world, CHG, messagesOf });
      draw = createConversationDrawing({ ...host.reading, ...host, CHG, msgItems: items.msgItems, typingRender: typing.render });
      const routes = transcriptActions({ ...host.actions(), needs: decision.D.needItems, convThread: place.convThread });
      for (const [id, route] of Object.entries(routes)) {
        const key = /** @type {import("../../shell/conversation-press-types").PressId} */ (id);
        ctx.contribute("conversation.press", pressEntry(key, route));
      }
      ctx.effect(() => () => { draw = undefined; items = undefined; });
    },
  };
  return {
    module, drawingView: () => items?.drawingView(),
    /** @type {ReturnType<typeof createConversationDrawing>} */
    drawConv: (conversation, needs) => draw?.(conversation, needs),
  };
}
