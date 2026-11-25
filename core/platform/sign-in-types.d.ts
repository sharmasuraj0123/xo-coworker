// @ts-check

export type SignInRoute = "claude-code" | "codex" | "antigravity";
export type CodeRoute = "claude-code" | "antigravity";
export type SignInReply = {ok: true; message: string; session_id: string | null};
export type CodeReply = {ok: true; message: string; session_id: string};
type LinkEvent = {type: "session"; session_id: string} | {type: "auth_url"; url: string};
type LogEvent = {type: "stdout" | "stderr" | "install_log"; line: string};
type EndEvent = {type: "done"; returncode: number | null; ok?: boolean} | {type: "error"; error: string; message?: string};
type StatusEvent = {type: "ping"} | {type: "installing"; package: string};
type CodeRejected = {type: "code_rejected"; retryable: true; message: string};
export type SignInEvent = LinkEvent | LogEvent | EndEvent | StatusEvent | CodeRejected;
export type StreamOptions = {force?: boolean; signal: AbortSignal; on: (event: SignInEvent) => void};
