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
