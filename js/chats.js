// @ts-check

import { createChats as createChatsModule } from "../modules/chats/chats.js";
import { turnHtml, turnAv } from "../modules/conversation/blocks/turn.js";
import { cliName, chatOrder, heldShort, heldBadge, dayGroup, rowTime } from "../core/services/world/timeline.js";

/** @param {Parameters<typeof createChatsModule>[0]} deps */
export function createChats(deps) {
  return createChatsModule(deps, { turnHtml, turnAv, cliName, chatOrder: /** @type {Parameters<typeof createChatsModule>[1]["chatOrder"]} */ (chatOrder), heldShort, heldBadge, dayGroup, rowTime });
}
