// @ts-check

import { api, NEWEST } from "../../core/platform/api.js";
import { ApiError } from "../../core/platform/http.js";
import { isPending, once } from "../../core/platform/pending.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { CHAT_LIST_LIMIT } from "./titles.js";

/** @import { ChatState, History } from "./types.d.ts" @import { ChatReadDeps } from "./read-types.d.ts" */
const HISTORY_RETRY_MS = 1000;

/** @param {ChatState} state @param {ChatReadDeps} deps */
export function createChatReads(state, { world, sessions, session, schedule, ensureModels, titles, signal }) {
  const listKey = Symbol("chat list");
  const loadList = () => {
    if (signal.aborted || isPending(listKey)) return;
    state.loading = true;
    return once(listKey, async () => {
      if (signal.aborted) return;
      try {
        const sent = world.act.sentAt();
        const data = await api.sessions({ role: "plain", before_seq: NEWEST, limit: CHAT_LIST_LIMIT }, { signal });
        if (signal.aborted) return;
        for (const record of data.sessions || []) world.act.noteSession(record, sent);
        state.list = true;
        state.err = null;
        for (const agent of new Set(sessions().flatMap((record) => record.agent ? [record.agent] : []))) ensureModels(agent);
      } catch (error) {
        if (!signal.aborted) state.err = requestFailureMessage(error, "Couldn't read the chats.");
      }
    }).then(() => {
      if (signal.aborted) return;
      state.loading = false;
      schedule();
    });
  };

  /** @param {string} id */
  async function readSession(id) {
    let record = session(id);
    if (record?.native_id && record.cwd !== undefined) return record;
    const sent = world.act.sentAt();
    try {
      const full = await api.session(id, { signal });
      if (full && !signal.aborted) world.act.noteSession(full, sent);
      record = session(id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
    return record;
  }

  /** @param {string} id @param {History} history */
  async function readHistory(id, history) {
    if (signal.aborted) return;
    const requestedNative = session(id)?.native_id ?? null;
    /** @type {string | null | undefined} */
    let native;
    function superseded() {
      if (native === undefined || (session(id)?.native_id ?? null) === native) return false;
      history.again = true;
      return true;
    }
    try {
      const record = await readSession(id);
      if (signal.aborted) return;
      if (!record) {
        history.error = "This chat isn't here any more.";
        return;
      }
      if (record.agent) ensureModels(record.agent);
      const trimmed = world.act.takeTrimmed?.(id);
      native = history.tried = record.native_id ?? null;
      const [observed] = await Promise.all([
        record.native_id ? api.observedMessages(record.native_id, undefined, { signal }) : null,
        (!history.turns || trimmed) ? world.act.loadTurns?.(id) : null,
      ]);
      if (signal.aborted || superseded()) return;
      history.turns = true;
      if (observed) {
        history.user = userPrompts(observed.messages);
        history.loaded = true;
        if (history.user[0]) titles.remember(record, history.user[0].text);
      }
      history.error = null;
      delete history.retry;
    } catch (error) {
      native ??= requestedNative;
      if (signal.aborted || superseded()) return;
      history.retry = { native, at: Date.now() + HISTORY_RETRY_MS };
      delete history.tried;
      history.error = requestFailureMessage(error, "Couldn't read the chat.");
    }
  }

  /** @param {string} id @param {{ afterTurn?: boolean }} [options] */
  function loadChat(id, { afterTurn = false } = {}) {
    if (signal.aborted) return;
    const history = state.hist.get(id) ?? {};
    state.hist.set(id, history);
    const retry = history.retry;
    if (afterTurn && retry && retry.native === (session(id)?.native_id ?? null) && retry.at > Date.now()) return;
    if (isPending(history)) {
      if (afterTurn) history.again = true;
      return;
    }
    history.loading = true;
    const pending = once(history, () => readHistory(id, history));
    schedule();
    return pending.then(() => {
      if (signal.aborted) return;
      history.loading = false;
      if (history.again) {
        history.again = false;
        if (!loadChat(id, { afterTurn: true })) schedule();
      } else schedule();
    });
  }

  return { loadList, loadChat };
}

// claude writes these into its transcript as the person's turn when a turn is interrupted
const CLI_NOTE = /^\[Request interrupted by user[^\]\n]*\]$/;

/** @param {import("../../core/platform/chat-response-types.d.ts").ObservedMessage[]} [messages] */
function userPrompts(messages = []) {
  return messages.filter((message) => message.data?.role === "user").map((message) => ({
    id: message.id,
    at: Date.parse(message.time_created) || 0,
    text: (message.parts || []).map((part) => part.data?.type === "text" ? part.data.text : "").join("\n").trim(),
  })).filter((prompt) => prompt.text && !CLI_NOTE.test(prompt.text));
}
