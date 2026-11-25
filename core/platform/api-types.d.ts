import type { ProjectApi } from "./project-response-types";
import type { ScheduleApi } from "./schedule-response-types";
import type { Policies, Router, RouterModel, Runtime, RuntimeModel } from "./runtime-response-types.d.ts";
import type {
  AbortReceipt, ActiveTurn, ChatRecord, CursorPage, HopRecord, MessageRecord, ObservedPage, PromptReceipt,
  Seen, SessionRecord, StoredFrame, ThreadContinuation, ThreadDeletion, ThreadRecord,
} from "./chat-response-types.d.ts";
import type { RunDetail, RunList, RunStopResult, RunTranscript } from "./run-response-types.d.ts";
import type { ReviewPage, ReviewRecord, Rule, RuleBatch } from "./review-response-types.d.ts";
import type { AccountIntents, Advisory, PaidReceipt } from "./account-response-types.d.ts";

type Json = ReturnType<typeof import("./http.js").request>;
type Query = Record<string, unknown>;
type Id = string;
interface BlobOptions { signal?: AbortSignal; ms?: number }
interface ReadOptions { signal?: AbortSignal }
type SignInRoute = "claude-code" | "codex" | "antigravity";

export interface Api extends ProjectApi, ScheduleApi {
  status(options?: ReadOptions): Promise<import("./status-types.d.ts").EngineStatus>;
  runtimes(options?: ReadOptions): Promise<{ runtimes: Runtime[] }>;
  models(runtime: string, options?: ReadOptions): Promise<{ models: RuntimeModel[] }>;
  runtimePolicy(options?: ReadOptions): Promise<Policies>;
  setRuntimePolicy(policy: object): Promise<Policies>;
  chatRuntimePolicy(chat: Id, options?: ReadOptions): Promise<Policies>;
  setChatRuntimePolicy(chat: Id, policy: object): Promise<Policies>;
  advisory(options?: ReadOptions): Promise<Advisory>;
  intents(options?: ReadOptions): Promise<AccountIntents>;
  setPaid(body: object): Promise<PaidReceipt>;
  router(options?: ReadOptions): Promise<Router>;
  setRouter(body: object, options?: ReadOptions): Promise<Router>;
  routerModels(options?: ReadOptions): Promise<{ models: RouterModel[] }>;
  connectRouterModel(body: object, options?: ReadOptions): Promise<{ models: RouterModel[] }>;
  disconnectRouterModel(provider: string, options?: ReadOptions): Promise<{ models: RouterModel[] }>;

  chats(options?: ReadOptions): Promise<{ chats: ChatRecord[] }>;
  chat(id: Id): Promise<ChatRecord>;
  patchChat(id: Id, body: object, options?: ReadOptions): Promise<ChatRecord>;
  messages(chat: Id, query?: Query, options?: ReadOptions): Promise<CursorPage & { messages: MessageRecord[] }>;
  post(chat: Id, message: { text?: string; threadTs?: string | null; clientId?: string; attachments?: string[] }): Promise<MessageRecord>;
  threads(chat: Id, options?: ReadOptions): Promise<{ threads: ThreadRecord[] }>;
  thread(chat: Id, ts: string, options?: ReadOptions): Promise<ThreadRecord>;
  patchThread(chat: Id, ts: string, body: object): Promise<ThreadRecord>;
  deleteThread(chat: Id, ts: string, body: object): Promise<ThreadDeletion>;
  restoreThread(chat: Id, ts: string): Promise<ThreadRecord>;
  continueThread(chat: Id, ts: string, body: object): Promise<ThreadContinuation>;
  hops(chat: Id, query?: Query, options?: ReadOptions): Promise<CursorPage & { hops: HopRecord[] }>;
  memory(chat: Id): Json;
  made(chat: Id, query?: Query, options?: ReadOptions): Json;
  pinMade(chat: Id, id: Id, on: boolean): Json;
  markSeen(chat: Id): Promise<{ seen: Seen }>;
  memoryFile(chat: Id, path: string): Json;

  shape(): Json;
  putShape(body: object): Json;

  sessions(query?: Query, options?: ReadOptions): Promise<CursorPage & { sessions: SessionRecord[] }>;
  session(id: Id, options?: ReadOptions): Promise<SessionRecord>;
  patchSession(id: Id, body: object): Promise<SessionRecord>;
  active(options?: ReadOptions): Promise<{ turns: ActiveTurn[] }>;
  events(query?: Query, options?: ReadOptions): Promise<CursorPage & { events: StoredFrame[] }>;

  observedMessages(nativeId: string, query?: Query, options?: ReadOptions): Promise<ObservedPage>;
  prompt(body: object): Promise<PromptReceipt>;
  abort(sessionId: Id): Promise<AbortReceipt>;

  review(query?: Query, options?: ReadOptions): Promise<ReviewPage>;
  reviewItem(id: Id, options?: ReadOptions): Promise<ReviewRecord>;
  decide(id: Id, body: object): Promise<ReviewRecord>;
  rules(query?: Query): Promise<RuleBatch>;
  addRule(body: object): Promise<Rule>;
  revokeRule(id: Id): Promise<Rule>;

  runs(session: Id, query?: Query, options?: ReadOptions): Promise<RunList>;
  run(id: Id, options?: ReadOptions): Promise<RunDetail>;
  transcript(id: Id, query?: Query, options?: ReadOptions): Promise<RunTranscript>;
  stopRun(id: Id): Promise<RunStopResult | null>;
  stopRuns(session: Id): Promise<RunStopResult | null>;

  worktrees(chat?: Id | null): Json;
  removeWorktree(chat: Id, ts: string, confirm?: string | null): Json;

  projectImage(project: Id, relativePath: string, opts?: BlobOptions): Promise<Blob>;
  projectVersion(project: Id, relativePath: string, at: { commit: string; was?: string | null }, opts?: BlobOptions): Promise<Blob>;
  projectDownload(project: Id, relativePath: string): Promise<Blob>;
  githubStatus(options?: ReadOptions): Json;
  githubIssues(project: Id, refresh?: boolean, options?: ReadOptions): Json;
  githubIssue(project: Id, number: Id | number, signal?: AbortSignal): Json;
  githubPulls(project: Id, options?: ReadOptions): Json;
  githubPull(project: Id, number: Id | number, signal?: AbortSignal): Json;
  githubConnect(fresh?: boolean): Json;
  githubConnectPoll(sessionId: Id, options?: ReadOptions): Json;
  githubConnectCancel(sessionId: Id): Json;
  githubDisconnect(): Json;
  signInStream(route: SignInRoute, options: { force?: boolean; signal: AbortSignal; on: (event: unknown) => void }): Promise<void>;
  signInCode(route: Exclude<SignInRoute, "codex">, sessionId: Id, code: string): Json;
  signInCancel(route: "claude-code"): Json;

  terminalStatus(options?: ReadOptions): Json;
  terminals(query?: Query, options?: ReadOptions): Json;
  terminal(id: Id, options?: ReadOptions): Json;
  openTerminal(body: object): Json;
  attachTerminal(id: Id, options?: ReadOptions): Promise<{ ticket: string; ticket_expires_in: number }>;
  renameTerminal(id: Id, name: string): Json;
  closeTerminal(id: Id): Json;

  streamUrl(): string;
}
