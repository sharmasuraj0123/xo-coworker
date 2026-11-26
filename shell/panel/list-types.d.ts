export interface Row {
  go: string;
  title: string;
  state: string;
  word: string;
  sub?: string;
  subHtml?: string;
  summary?: string | null;
  branch?: string | null;
  since?: number | null;
  color?: string;
  on?: boolean;
  coord?: boolean;
  mark?: string;
  at?: string;
  icon?: string;
}
export interface Group { k: string; word?: string; rows: Row[] }
export interface Agent { go: string; title: string; color: string; doing: string; since: number | null; busy?: boolean; waiting?: boolean }
export interface Change { path: string; rel: string; project: string; who?: string; mark?: string; live?: boolean }
export interface ListOptions { folds: Record<string, boolean>; more: Record<string, unknown>; noun?: string; none?: string }
