export interface GitHubState {
  status: string;
  username?: string;
  imported?: boolean;
  code?: string;
  uri?: string;
  session?: string;
  error?: string;
}

export interface CloneStatus {
  state: string;
  phase?: string;
  percent?: number;
  received_bytes?: number;
  idle_seconds?: number;
  warning?: string | null;
  error?: { message?: string; code?: string; detail?: string } | null;
}

export interface CloneActivity {
  t0: number;
  label?: string;
  host?: string | null;
  stopTick?: () => void;
  cloneId?: string;
  st?: CloneStatus;
}

export interface ProjectFailure {
  message: string;
  status?: number;
  code?: string;
  detail?: string;
}

export interface WorkspaceConfig {
  roots?: Record<string, string>;
  default: string;
}

export type CloneNotice = [text: string, action: { id: string; label: string } | null, focus?: "name" | "repo"];
