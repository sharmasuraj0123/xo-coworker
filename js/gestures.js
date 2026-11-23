// @ts-check

import { wordsOf } from "../modules/conversation/words.js";
import { conversationGestures as bindConversation, wireGestures as bindShell } from "../shell/gestures.js";

export { dockGestures } from "../shell/gestures.js";
export { copyText } from "../core/platform/index.js";

/** @param {Parameters<typeof bindShell>[0]} A */
export function wireGestures(A) { bindShell(A, wordsOf); }

/** @param {Parameters<typeof bindConversation>[0]} C */
export function conversationGestures(C) { bindConversation(C, wordsOf); }
