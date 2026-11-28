interface ReadOptions { signal?: AbortSignal }

export interface Terminal {
  id: string;
  name: string;
  scope: "workspace" | "project";
  project: string | null;
  path: string | null;
  cwd: string;
  status: "running" | "exited";
  exit_code: number | null;
  ended_reason: string | null;
  foreground: string | null;
  viewers: number;
  size: { rows: number; cols: number };
  created_at: string;
  last_attached_at: string | null;
  last_output_at: string | null;
  detached_since: string | null;
  closes_at: string | null;
  ended_at: string | null;
}

export interface TerminalStatus {
  enabled: boolean;
  reason: string | null;
  max_sessions: number;
  detached_ttl_seconds: number;
  running: number;
  attached: number;
}

export interface TerminalTicket { ticket: string; ticket_expires_in: number }
export interface TerminalDetail { terminal: Terminal }
export interface TerminalList { terminals: Terminal[] }
export interface CreatedTerminal extends TerminalDetail, TerminalTicket {}
export interface ClosedTerminal { ok: true; closed: string }
interface TerminalInput {
  project?: string | null;
  path?: string | null;
  name?: string | null;
  rows?: number | null;
  cols?: number | null;
}

export interface TerminalApi {
  terminalStatus(options?: ReadOptions): Promise<TerminalStatus>;
  terminals(query?: Record<string, unknown>, options?: ReadOptions): Promise<TerminalList>;
  terminal(id: string, options?: ReadOptions): Promise<TerminalDetail>;
  openTerminal(body: TerminalInput): Promise<CreatedTerminal>;
  attachTerminal(id: string, options?: ReadOptions): Promise<TerminalTicket>;
  renameTerminal(id: string, name: string): Promise<TerminalDetail>;
  closeTerminal(id: string): Promise<ClosedTerminal>;
}
