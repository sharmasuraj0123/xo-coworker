type AccountsScope = ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
type Bus = import("../../core/kernel/types").Bus;

export interface Action {
  id: string;
  label: string;
  pri?: boolean;
  busy?: boolean;
}

export interface View {
  key: string;
  tone: string;
  line: string;
  actions: Action[];
}

export interface GitHubStatus {
  status: string;
  username?: string;
  name?: string;
  scopes?: string;
  error?: string;
  gh_login?: { usable?: boolean, username?: string };
}

export interface GitHubFlow {
  starting?: boolean;
  code?: string;
  uri?: string;
  id?: string;
  until?: number;
}

export interface Agent {
  name: string;
  health?: { installed?: boolean, logged_in?: boolean } | null;
  default?: boolean;
}

export interface AgentFlow {
  phase: string;
  ctl: AbortController;
  abortable: boolean;
  url?: string;
  code?: string;
  log?: string;
  opened?: boolean;
  session?: string;
}

export interface SignInEvent {
  type: string;
  session_id?: string;
  url?: string;
  line?: string;
  returncode?: number;
  error?: string;
}

export type SignIn =
  | { route: "claude-code", kind: "paste", cancel: true }
  | { route: "antigravity", kind: "paste", cancel?: false }
  | { route: "codex", kind: "device", cancel?: false };

export interface GithubAccountState {
  gh: GitHubStatus | null;
  flow: GitHubFlow | null;
  err: string;
  confirm: boolean;
}

export interface GithubAccountOptions {
  scope: AccountsScope;
  announce: (message: string) => void;
  draw: () => void;
  focus: (selector: string, from?: Element) => void;
  bus?: Pick<Bus, "on" | "emit">;
}

export interface AccountsState {
  rts: Agent[] | null;
  rtErr: string;
  f: Record<string, AgentFlow>;
  e: Record<string, string>;
  missing: Record<string, boolean>;
}

export interface AccountControls {
  scope: AccountsScope;
  box: () => Element | null;
  state: AccountsState;
  github: ReturnType<typeof import("./github-account.js").createGithubAccount>;
  agentIn(runtime: string, force: boolean): Promise<void>;
  agentCancel(runtime: string): void;
  agentCode(runtime: string, code: string): Promise<void>;
  draw(): void;
  focus(selector: string): void;
  announce(message: string): void;
}
