// @ts-check

import { createHerald } from "../notices.js";
import { createScope } from "../../kernel/scope.js";

/** @import { Notice } from "../notices.js" */

/** @param {() => void} schedule */
export function createConversationNotices(schedule) {
  const scope = createScope();
  /** @type {{ herald: Notice | null }} */
  const state = { herald: null };
  const { show, forMsg, next, drop, HQ } = createHerald({
    state, schedule, setTimer: scope.timeout,
    clearTimer: (cancel) => { if (typeof cancel === "function") cancel(); },
  });
  const current = () => state.herald && state.herald.until > Date.now() ? state.herald : null;

  /** @param {(notice: Notice) => boolean} matches */
  function dismiss(matches) {
    const line = current();
    if (line && matches(line)) {
      state.herald = { ...line, until: 0 };
      next();
    }
  }

  return {
    current, dismiss,
    /** @param {string} mid */
    has: mid => !scope.signal.aborted && (current()?.mid === mid || HQ.some(({ h }) => h.mid === mid)),
    /** @type {typeof show} */
    show: (...args) => { if (!scope.signal.aborted) show(...args); },
    /** @type {typeof forMsg} */
    forMsg: (...args) => !scope.signal.aborted && forMsg(...args),
    /** @type {typeof drop} */
    drop: (id) => { if (!scope.signal.aborted) drop(id); },
    undo() {
      const line = current();
      if (line) runNoticeUndo(line, next);
    },
    dispose() { scope.dispose(); state.herald = null; },
  };
}

/** @param {Notice} notice @param {() => void} next */
function runNoticeUndo(notice, next) {
  if (typeof notice.undo !== "function" || (notice.undoUntil && Date.now() > notice.undoUntil)) return;
  notice.until = 0;
  notice.undo();
  next();
}
