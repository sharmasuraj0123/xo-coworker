// @ts-check

import { ApiError, coderHeaders, isResponseObject, urlOf } from "./http.js";
import { checkedResponse, requestChecked } from "./response.js";
import { readJsonEvents } from "./sse.js";

/** @import {SignInReply, CodeReply, SignInEvent, StreamOptions} from "./sign-in-types.d.ts" */

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

const enc = encodeURIComponent;
/** @param {string} name */
const signInPath = (name) => `chat/runtimes/${enc(name)}/sign-in`;

/** A runtime's sign-in, its CLI's frames as they come; closing it stops the CLI. @param {string} name @param {StreamOptions} options */
async function signInStream(name, { signal, on }) {
  signal.throwIfAborted();
  const path = urlOf("/" + signInPath(name));
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

/** @param {string} name @param {string} sessionId @param {string} code */
async function signInCode(name, sessionId, code) {
  const path = `/${signInPath(name)}/callback`;
  return requestChecked(path, isCodeReply, { method: "POST", body: { session_id: sessionId, code } });
}

/** @param {string} name */
async function signInCancel(name) {
  return requestChecked(`/${signInPath(name)}`, isReply, { method: "DELETE" });
}

export const signInApi = { signInStream, signInCode, signInCancel };
