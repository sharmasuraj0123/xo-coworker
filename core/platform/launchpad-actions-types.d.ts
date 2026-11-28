// @ts-check

export interface App {
  id: string;
  name: string;
  slug: string | null;
  source: string | null;
  status: string | null;
  url: string | null;
  repo: string | null;
  branch: string | null;
  port: number | null;
}

interface ListedApp extends App { linkable: boolean; match: ("name" | "repo")[] }

export interface Apps { apps: ListedApp[]; linked: string | null; name: string }

export interface Link { config: { app_id: string; name: string; url: string | null }; commit: string | null; app: App }

export interface Unlink { unlinked: { app_id: string | null; name: string | null }; forgot: boolean; commit: string | null }

export type Stop = { stopped: false } | { stopped: true; run_id: string };

export type AskAgent = { chat_id: string; thread_ts: string } & ({ already: true } | { already: false; state: string });

export interface ActionsApi {
  launchpadApps(project: string, signal?: AbortSignal): Promise<Apps>;
  launchpadLink(project: string, app: string): Promise<Link>;
  launchpadUnlink(project: string): Promise<Unlink>;
  launchpadStop(project: string): Promise<Stop>;
  launchpadAskAgent(project: string, note: string): Promise<AskAgent>;
}
