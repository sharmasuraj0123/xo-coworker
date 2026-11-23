export type MediaDate = string | number | null;

export interface MadeRef {
  made_id?: string | number | null;
}

export interface FileRoute {
  project?: string | null;
  rel?: string | null;
  why?: string | null;
}

interface FileDetails extends MadeRef {
  name?: string | null;
  path?: string | null;
  title?: string | null;
  type?: string | null;
  bytes?: number | null;
  w?: number | string | null;
  h?: number | string | null;
  tint?: string | null;
}

export interface MediaInput extends FileDetails, FileRoute {
  key?: string;
  by?: string | null;
  at?: MediaDate;
  made?: string | null;
  src?: string | null;
  att?: { chat: string; id: string } | null;
  web?: { url: string; host: string } | null;
}

export interface SharedFile extends FileDetails {
  id?: string | null;
  chat?: string | null;
  size?: number | null;
  project_id?: string | null;
  relative_path?: string | null;
  mtime?: string | number | null;
}

export interface MediaItem {
  key: string;
  name: string;
  title: string | null;
  type: string;
  bytes: number | null;
  w: number | null;
  h: number | null;
  tint: string | null;
  made: string | null;
  by: string;
  at: MediaDate;
  src: string | null;
  att: NonNullable<MediaInput["att"]> | null;
  project: string | null;
  rel: string | null;
  path: string | null;
  why: string | null;
  web: NonNullable<MediaInput["web"]> | null;
  kind: "image" | "file";
}
