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
  name?: string | null;
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

export interface AccountControls {
  scope: AccountsScope;
  box: () => Element | null;
  github: ReturnType<typeof import("./github-account.js").createGithubAccount>;
  focus(selector: string): void;
  announce(message: string): void;
}
