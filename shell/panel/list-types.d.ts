export interface Row {
  go: string;
  title: string;
  state: string;
  word: string;
  sub?: string;
  subHtml?: string;
  summary?: string;
  branch?: string;
  since?: number | null;
  color?: string;
  on?: boolean;
  coord?: boolean;
  mark?: string;
  at?: string;
}
export interface Group { k: string; word?: string; rows: Row[] }
export interface Agent { go: string; title: string; color: string; doing: string; since?: number; busy?: boolean; waiting?: boolean }
export interface Change { path: string; rel: string; project: string; who: string; mark: string; live?: boolean }
