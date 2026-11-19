export interface SettingsHost {
  R: {
    router: any; models: any[]; rules: any[] | null; defaults: any[]; trees: any[] | null; reported: any[];
    err: Record<string, any>; form: string | null; confirm: any;
  };
  box: (id: string) => any;
  paint: (id: string, html: string) => void;
  focusTo: (id: string, to: string | null | undefined) => void;
  land: (id: string, to: string | null | undefined, from: Element | null | undefined) => void;
  pend: (key: string, page: string, render: () => void, work: () => Promise<any>, from?: Element | null) => Promise<any>;
  neighbour: (from: Element | null, row: string, attr: string) => string | null;
  sel: (attr: string, v: string) => string;
  errHtml: (text: string | null | undefined) => string;
  waits: (key: string) => string;
  when: (iso: string) => string;
}
export interface PageDeps { world: any; announce: (words: string) => void; PROJ: (id: string) => string; onChange: () => void }
