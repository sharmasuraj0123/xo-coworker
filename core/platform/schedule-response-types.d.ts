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

interface JobFields {
  id: string;
  name: string;
  enabled: boolean;
  running: boolean;
  description: string | null;
  every_seconds: number | null;
  first_run_at?: string | null;
  next_run: string | null;
  last_run: string | null;
  running_since: string | null;
  last_result: ScheduleResult | null;
  created_at?: string;
  updated_at?: string;
  fire?: { at: string; trigger: string };
  disabled_by?: { kind: string; reason?: string; at?: string };
  icon?: string;
}

interface AgentJob {
  kind: "agent";
  chat: string;
  prompt: string;
  utc_offset: string;
  agent: string | null;
  model: string | null;
  effort: string | null;
  created_by?: { kind: string };
  approved_by?: { review_id: string } | null;
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
  runs: ScheduleRun[];
  log_path: string;
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
}

export interface ScheduleStarted {
  ok: true;
  started: boolean;
  job: ScheduledJob;
}

export interface ScheduleApi {
  schedules(signal?: AbortSignal): Promise<ScheduleList>;
  schedule(id: string): Promise<ScheduledJob>;
  scheduleRuns(id: string, query?: Record<string, unknown>, signal?: AbortSignal): Promise<ScheduleRuns>;
  createSchedule(body: AgentJobBody): Promise<ScheduledJob>;
  updateSchedule(id: string, body: AgentJobBody): Promise<ScheduledJob>;
  deleteSchedule(id: string): Promise<{ ok: true; deleted: string }>;
  runSchedule(id: string): Promise<ScheduleStarted>;
}
