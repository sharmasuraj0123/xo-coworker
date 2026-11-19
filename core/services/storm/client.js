// @ts-check
import { api, NEWEST } from "../../../js/api.js";
import { clientId, coderHeaders } from "../../platform/http.js";
import { SSEStream } from "../../platform/sse.js";

export { clientId, NEWEST, coderHeaders, SSEStream };

/** Every XO Space route storm reads or writes, and the global stream's address. */
export const client = {
  chats: api.chats, threads: api.threads, thread: api.thread, patchThread: api.patchThread,
  deleteThread: api.deleteThread, restoreThread: api.restoreThread,
  messages: api.messages, post: api.post, hops: api.hops, events: api.events,
  sessions: api.sessions, abort: api.abort, runs: api.runs, run: api.run, transcript: api.transcript, stopRun: api.stopRun, stopRuns: api.stopRuns,
  review: api.review, reviewItem: api.reviewItem, decide: api.decide,
  status: api.status, runtimes: api.runtimes, router: api.router, advisory: api.advisory, intents: api.intents, setPaid: api.setPaid,
  runtimePolicy: api.runtimePolicy, setRuntimePolicy: api.setRuntimePolicy, chatRuntimePolicy: api.chatRuntimePolicy, setChatRuntimePolicy: api.setChatRuntimePolicy,
  streamUrl: api.streamUrl,
};
