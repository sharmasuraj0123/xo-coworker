type Json = Promise<any>;
type Query = Record<string, unknown>;
type Id = string;
interface BlobOptions { signal?: AbortSignal; ms?: number }
type SignInRoute = "claude-code" | "codex" | "antigravity";

export interface Api {
  status(): Json;
  runtimes(): Json;
  models(runtime: string): Json;
  runtimePolicy(): Json;
  setRuntimePolicy(policy: object): Json;
  chatRuntimePolicy(chat: Id): Json;
  setChatRuntimePolicy(chat: Id, policy: object): Json;
  advisory(): Json;
  intents(): Json;
  setPaid(body: object): Json;
  router(): Json;
  setRouter(body: object): Json;
  routerModels(): Json;
  connectRouterModel(body: object): Json;
  disconnectRouterModel(provider: string): Json;

  chats(): Json;
  chat(id: Id): Json;
  patchChat(id: Id, body: object): Json;
  messages(chat: Id, query?: Query): Json;
  post(chat: Id, message: { text?: string; threadTs?: string | null; clientId?: string; attachments?: string[] }): Json;
  threads(chat: Id): Json;
  thread(chat: Id, ts: string): Json;
  patchThread(chat: Id, ts: string, body: object): Json;
  deleteThread(chat: Id, ts: string, body: object): Json;
  restoreThread(chat: Id, ts: string): Json;
  continueThread(chat: Id, ts: string, body: object): Json;
  hops(chat: Id, query?: Query): Json;
  memory(chat: Id): Json;
  made(chat: Id, query?: Query): Json;
  pinMade(chat: Id, id: Id, on: boolean): Json;
  markSeen(chat: Id): Json;
  memoryFile(chat: Id, path: string): Json;

  shape(): Json;
  putShape(body: object): Json;

  sessions(query?: Query): Json;
  session(id: Id): Json;
  patchSession(id: Id, body: object): Json;
  active(): Json;
  events(query?: Query): Json;

  observedMessages(nativeId: string, query?: Query): Json;
  prompt(body: object): Json;
  abort(sessionId: Id): Json;

  review(query?: Query): Json;
  reviewItem(id: Id): Json;
  decide(id: Id, body: object): Json;
  rules(query?: Query): Json;
  addRule(body: object): Json;
  revokeRule(id: Id): Json;

  runs(session: Id, query?: Query): Json;
  run(id: Id): Json;
  transcript(id: Id, query?: Query): Json;
  stopRun(id: Id): Json;
  stopRuns(session: Id): Json;

  worktrees(chat?: Id | null): Json;
  removeWorktree(chat: Id, ts: string, confirm?: string | null): Json;

  schedules(): Json;
  schedule(id: Id): Json;
  scheduleRuns(id: Id, query?: Query): Json;

  projectFile(project: Id, relativePath: string, at?: { commit: string; path?: string } | null, opts?: { purpose?: string; version?: string }): Json;
  saveProjectFile(project: Id, relativePath: string, content: string, baseVersion: string | null, confirm?: string | null, opts?: { restoreOf?: string | null }): Json;
  projectVersions(project: Id, relativePath: string, opts?: { limit?: number; before?: string | null }): Json;
  projectPaths(project: Id, opts?: { worktree?: string | null; stamp?: string | null }): Json;
  projectSearch(project: Id, opts?: { q?: string; worktree?: string | null; regex?: boolean; case?: boolean; word?: boolean; glob?: string | null; limit?: number }): Json;
  renameProjectFile(project: Id, relativePath: string, newRelativePath: string, confirm?: string | null): Json;
  deleteProjectFile(project: Id, relativePath: string, baseVersion?: string | null, confirm?: string | null): Json;
  mkdirProject(project: Id, relativePath: string): Json;
  undoProjectEdit(project: Id, editId: Id): Json;
  projectChanges(project: Id, opts?: { worktree?: string | null; path?: string | null }): Json;
  projectTree(project: Id, relativePath?: string | null): Json;
  projectImage(project: Id, relativePath: string, opts?: BlobOptions): Promise<Blob>;
  projectVersion(project: Id, relativePath: string, at: { commit: string; was?: string | null }, opts?: BlobOptions): Promise<Blob>;
  projectDownload(project: Id, relativePath: string): Promise<Blob>;
  workspaceConfig(): Json;
  createProject(project: { path: string; displayName?: string; description?: string }): Json;
  cloneProject(clone: { id: string; url: string; displayName?: string; description?: string }): Json;
  cloneStatus(cloneId: Id): Json;
  cancelClone(cloneId: Id): Json;
  githubStatus(): Json;
  githubIssues(project: Id, refresh?: boolean): Json;
  githubIssue(project: Id, number: Id | number): Json;
  githubPulls(project: Id): Json;
  githubPull(project: Id, number: Id | number): Json;
  githubConnect(fresh?: boolean): Json;
  githubConnectPoll(sessionId: Id): Json;
  githubConnectCancel(sessionId: Id): Json;
  githubDisconnect(): Json;
  signInStream(route: SignInRoute, options: { force?: boolean; signal: AbortSignal; on: (event: unknown) => void }): Promise<void>;
  signInCode(route: Exclude<SignInRoute, "codex">, sessionId: Id, code: string): Json;
  signInCancel(route: "claude-code"): Json;

  terminalStatus(): Json;
  terminals(query?: Query): Json;
  terminal(id: Id): Json;
  openTerminal(body: object): Json;
  attachTerminal(id: Id): Json;
  renameTerminal(id: Id, name: string): Json;
  closeTerminal(id: Id): Json;

  streamUrl(): string;
}
