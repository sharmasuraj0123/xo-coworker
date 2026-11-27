// @ts-check

export interface ScheduleResult {
  started_at: string;
  finished_at: string;
  status: string;
  trigger: string | null;
  returncode?: number | null;
  duration_seconds?: number | null;
  output_tail?: string;
  fire_at?: string | null;
  chat_id?: string;
  thread_ts?: string;
  already?: boolean;
  code?: string;
  reason?: string;
  found?: boolean;
  summary?: string;
}

export interface ScheduleRun extends ScheduleResult {
  ts: string;
  type: "job.run";
  job_id: string;
}

export interface ThreadRef {
  chat_id: string;
  ts: string;
  state?: string | null;
}

export interface AgentFire {
  at: string;
  status: string;
  trigger?: string | null;
  chat_id?: string | null;
  thread_ts?: string | null;
  already?: boolean | null;
  code?: string | null;
  reason?: string | null;
  found?: boolean | null;
  summary?: string | null;
  thread?: ThreadRef | null;
}

export interface AgentRun {
  fire_at: string;
  trigger: string;
  status?: string | null;
  reason?: string | null;
  found?: boolean | null;
  summary?: string | null;
  thread?: ThreadRef | null;
}

export type ScheduleRule =
  | { days: "weekdays" | string[]; time: string; tz?: string }
  | { day_of_month: number | "last"; time: string; tz?: string }
  | { every_seconds: number; tz?: string };

export interface PersonaRef {
  name: string;
  level: string;
}

interface JobFields {
  id: string;
  name: string;
  enabled: boolean;
  running: boolean;
  description: string | null;
  every_seconds: number | null;
  first_run_at?: string | null;
  next_run: string | null;
  last_run?: string | null;
  running_since?: string | null;
  last_result: ScheduleResult | AgentFire | null;
  created_at?: string;
  updated_at?: string;
  fire?: { at: string; trigger: string };
  disabled_by?: { kind: string; reason?: string; at?: string };
  icon?: string | null;
}

interface AgentJob {
  kind: "agent";
  chat: string;
  prompt: string;
  utc_offset: string;
  agent: string | null;
  model: string | null;
  effort: string | null;
  created_by?: { kind: string; session_id?: string };
  approved_by?: { review_id: string } | null;
  state?: string | null;
  state_reason?: string | null;
  schedule?: ScheduleRule | null;
  persona?: PersonaRef | null;
  upcoming?: string[];
}

interface CommandJob {
  kind?: "command";
  project_id: string | null;
  command: { argv: string[]; timeout: number; cwd?: string; env?: Record<string, string> };
}

export type ScheduledJob = JobFields & (AgentJob | CommandJob);

export interface ScheduleList {
  jobs: ScheduledJob[];
}

export interface ScheduleRuns {
  job_id: string;
  runs: (ScheduleRun | AgentRun)[];
  log_path: string | null;
}

export interface AgentJobBody {
  kind: "agent";
  name: string;
  description: string | null;
  chat: string;
  prompt: string;
  agent: string | null;
  model: string | null;
  effort: string | null;
  every_seconds: number | null;
  first_run_at: string | null;
  enabled: boolean;
  schedule?: ScheduleRule | null;
  persona: PersonaRef | null;
  icon: string | null;
}

export interface ScheduleStarted {
  ok: true;
  started: boolean;
  job: ScheduledJob;
  chat_id?: string;
  ts?: string;
}

export interface ScheduleApi {
  schedules(signal?: AbortSignal, upcoming?: number): Promise<ScheduleList>;
  schedule(id: string): Promise<ScheduledJob>;
  scheduleRuns(id: string, query?: Record<string, unknown>, signal?: AbortSignal): Promise<ScheduleRuns>;
  createSchedule(body: AgentJobBody): Promise<ScheduledJob>;
  updateSchedule(id: string, body: AgentJobBody): Promise<ScheduledJob>;
  deleteSchedule(id: string): Promise<{ ok: true; deleted: string }>;
  runSchedule(id: string): Promise<ScheduleStarted>;
  scheduleZone(): Promise<{ tz: string }>;
  setScheduleZone(tz: string): Promise<{ tz: string }>;
}
