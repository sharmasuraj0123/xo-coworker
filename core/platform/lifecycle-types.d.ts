export type JobAction = "install" | "update" | "uninstall" | "sign_out";
export interface JobResult {
  type?: string;
  returncode?: number;
  version_before?: string | null;
  version?: string | null;
  update?: string | null;
  code?: string;
  error?: string;
  message?: string;
}
export interface Job {
  id: string;
  runtime: string;
  action: JobAction | string;
  status: "running" | "done" | "failed";
  log: string[];
  result: JobResult | null;
}
export interface RemoteControl {
  running?: boolean;
  session_url?: string | null;
  status?: string | null;
  error?: string | null;
  detail?: string | null;
}
