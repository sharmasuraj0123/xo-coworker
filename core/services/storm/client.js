// @ts-check
import { api, NEWEST } from "../../platform/api.js";
import { ApiError, clientId, coderHeaders } from "../../platform/http.js";
import { SSEStream } from "../../platform/sse.js";

import { reportFailure } from "../notices/failures.js";

export { clientId, NEWEST, coderHeaders, SSEStream };

/** Every XO Space route storm reads or writes, and the global stream's address. */
export const client = {
  chats: api.chats, threads: api.threads, thread: api.thread, patchThread: api.patchThread,
  deleteThread: api.deleteThread, restoreThread: api.restoreThread,
  messages: api.messages, post: api.post, hops: api.hops, events: api.events,
  active: api.active, sessions: api.sessions, abort: api.abort, runs: api.runs, run: api.run, transcript: api.transcript, stopRun: api.stopRun, stopRuns: api.stopRuns,
  review: api.review, reviewItem: api.reviewItem, decide: api.decide,
  status: api.status, runtimes: api.runtimes, router: api.router, advisory: api.advisory, intents: api.intents, setPaid: api.setPaid,
  runtimePolicy: api.runtimePolicy, setRuntimePolicy: api.setRuntimePolicy, chatRuntimePolicy: api.chatRuntimePolicy, setChatRuntimePolicy: api.setChatRuntimePolicy,
  streamUrl: api.streamUrl,
};

/** @param {unknown} error @param {AbortSignal} signal @param {boolean} [allowMissing] */
export function reportReadFailure(error, signal, allowMissing = false) {
  if (signal.aborted || (allowMissing && error instanceof ApiError && error.status === 404)) return;
  reportFailure(error);
}

/** @template T @param {AbortSignal} owner @param {AbortSignal | undefined} caller @param {(signal: AbortSignal) => Promise<T>} read */
export async function worldRead(owner, caller, read) {
  const signal = caller ? AbortSignal.any([owner, caller]) : owner;
  signal.throwIfAborted();
  const value = await read(signal);
  signal.throwIfAborted();
  return value;
}
