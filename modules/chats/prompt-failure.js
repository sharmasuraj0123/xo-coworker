// @ts-check

import { ApiError } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @type {import("./read-types.d.ts").PromptFailure} */
export const promptFailure = (confirm, { restore, heraldShow }, local, sid, error) => {
  const code = error instanceof ApiError ? error.code : null;
  const status = error instanceof ApiError ? error.status : null;
  if (code === "would_stop_runs") {
    const count = Number(/** @type {ApiError & { count?: number }} */ (error).count);
    confirm.set(sid, { local, sid, count: Number.isInteger(count) && count >= 0 ? count : 0 });
    local.status = "held";
    return;
  }
  local.status = "failed";
  local.errTitle = code === "auth_required" ? "The agent isn't connected"
    : code === "timeout" ? "No answer from XO"
    : status === 501 ? "This agent can't chat yet"
    : status === 0 || status === 502 ? "Can't reach XO" : "Not sent";
  local.err = error instanceof ApiError && (code === "auth_required" || status === 501)
    ? error.message : requestFailureMessage(error, local.errTitle);
  if (sid) return;
  if (restore?.(local.body.text)) {
    heraldShow({ kind: "stopped", text: local.errTitle, sub: `${local.err} Your message is back in the box.` }, 7000);
  } else {
    heraldShow({
      kind: "stopped", text: local.errTitle, sub: local.err,
      undo: () => restore?.(local.body.text, { force: true }), undoLabel: "Put my message back",
    }, 12000);
  }
};
