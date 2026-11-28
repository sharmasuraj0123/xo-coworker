export interface Connected {
  status: "connected";
  username: string;
  name?: string | null;
  avatar_url?: string;
  auth_method?: string;
  scopes?: string;
  imported?: boolean;
}

interface NotConnected {
  status: "failed" | "needs_auth";
  error?: string;
  auth_method?: string;
  gh_login?: { logged_in: boolean; usable: boolean; username?: string; scopes?: string; missing?: string[]; error?: string };
}

export type Status = (Connected | NotConnected) & { valid?: boolean };
interface DeviceCode { session_id: string; user_code: string; verification_uri: string; expires_in: number }
export type Start = DeviceCode & (Connected | { status?: undefined });
export type Poll = Connected | { status: "pending"; user_code: string; verification_uri: string };
export interface Cancel { status: "cancelled" | "not_found" }
export interface Disconnect { status: "needs_auth" }

interface ReadOptions { signal?: AbortSignal }

export interface AuthApi {
  githubStatus(options?: ReadOptions): Promise<Status>;
  githubConnect(fresh?: boolean, options?: ReadOptions & { body?: Record<string, never> }): Promise<Start>;
  githubConnectPoll(sessionId: string, options?: ReadOptions): Promise<Poll>;
  githubConnectCancel(sessionId: string): Promise<Cancel>;
  githubDisconnect(options?: ReadOptions): Promise<Disconnect>;
}
