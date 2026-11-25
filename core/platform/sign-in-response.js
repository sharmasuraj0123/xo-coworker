// @ts-check

import { ApiError, coderHeaders, exchange, isResponseObject } from "./http.js";
import { checkedResponse } from "./response.js";
import { readJsonEvents } from "./sse.js";

/** @import {SignInRoute, CodeRoute, SignInReply, CodeReply, SignInEvent, StreamOptions} from "./sign-in-types.d.ts" */

/** @param {unknown} value @returns {value is SignInEvent} */
function isFrame(value) {
  if (!isResponseObject(value)) return false;
  switch (value.type) {
    case "session": return typeof value.session_id === "string";
    case "auth_url": return typeof value.url === "string";
    case "stdout": case "stderr": case "install_log": return typeof value.line === "string";
    case "done": return (Number.isInteger(value.returncode) || value.returncode === null)
      && (value.ok === undefined || typeof value.ok === "boolean");
    case "error": return typeof value.error === "string" && (value.message === undefined || typeof value.message === "string");
    case "ping": return true;
    case "installing": return typeof value.package === "string";
    case "code_rejected": return value.retryable === true && typeof value.message === "string";
    default: return false;
  }
}

/** @param {unknown} value @returns {value is SignInReply} */
function isReply(value) {
  return isResponseObject(value) && value.ok === true && typeof value.message === "string"
    && (value.session_id === null || typeof value.session_id === "string");
}

/** @param {unknown} value @returns {value is CodeReply} */
const isCodeReply = (value) => isReply(value) && typeof value.session_id === "string";

/** @param {SignInRoute} route @param {StreamOptions} options */
async function signInStream(route, { force = false, signal, on }) {
  signal.throwIfAborted();
  const path = `connect/${route}${force ? "?force=1" : ""}`;
  let res;
  try {
    res = await fetch(path, {
      method: "POST", signal, headers: { Accept: "text/event-stream", ...coderHeaders() }, cache: "no-store", redirect: "manual",
    });
  } catch (err) {
    signal.throwIfAborted();
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError(0, "network", "Can't reach the UI server. Is serve.py running?");
  }
  signal.throwIfAborted();
  if (!res.ok) throw new ApiError(res.status, `http_${res.status}`, `Space answered ${res.status}.`);
  await readJsonEvents(res, (frame) => on(checkedResponse(frame, isFrame, `POST /${path}`)), signal);
}

/** @param {CodeRoute} route @param {string} sessionId @param {string} code */
async function signInCode(route, sessionId, code) {
  const path = `connect/${route}/callback`;
  const reply = await exchange(path, "POST", { session_id: sessionId, code });
  return checkedResponse(reply, isCodeReply, `POST /${path}`);
}

/** @param {"claude-code"} route */
async function signInCancel(route) {
  const path = `connect/${route}`;
  return checkedResponse(await exchange(path, "DELETE"), isReply, `DELETE /${path}`);
}

export const signInApi = { signInStream, signInCode, signInCancel };
