// @ts-check

type Text = string | null;
type Count = number | null;
type Meta = {ts: string; run_id?: string; seq?: number};
type App = {id?: Text; name?: Text; slug?: Text};
type Run = {type: "run"; run_id: string; kind: "deploy" | "watch"; attached: boolean; started_at: string; after?: number};
type Step = {type: "step"; step: string; status: string; message?: Text; title?: Text; elapsed?: Count};
type Notice = {type: "progress"; step?: Text; message?: Text; data?: Data | null} | {type: "warning"; step?: Text; message: string};
type Release = {id?: Text; number?: Count; rollout_status?: Text; created_at?: Text; finished_at?: Text};
type Live = {state?: Text; reason?: Text; message?: Text};
type Status = {type: "status"; app?: App | null; release?: Release | null; live?: Live | null};
type Done = {type: "done"; url?: Text; commit?: Text; release?: Count; http_status?: Count; app?: App | null;
  repo?: Text; branch?: Text; created?: boolean | null};
interface Data {
  app_id?: Text;
  app?: {id: string} | null;
  run_url?: Text;
  source?: Text;
  failed_step?: Text;
  kind?: Text;
  repo?: Text;
  suggestion?: Text;
  ready?: Count;
  desired?: Count;
  release?: Count;
  port?: Count;
  log_tail?: string | string[] | null;
  exposed_ports?: number[] | null;
  apps?: {id: string; slug?: Text; workflow?: Text}[] | null;
}
type Failure = {type: "error" | "needs"; code: string; message: string; step?: Text; fix?: Text; action?: Text;
  data?: Data | null; options?: {id: string; label: string}[]};
type Replaced = {type: "replaced"; by: {run_id: string; kind: "deploy"}};
export type Frame = Meta & (Run | Step | Notice | Status | Done | Failure | Replaced | {type: "ping"});
export type Listener = {signal: AbortSignal; on: (frame: Frame) => void};
