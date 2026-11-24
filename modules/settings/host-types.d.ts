export interface SettingsPage {
  open(): void | Promise<unknown>;
  click(target: Element): boolean;
  clickFirst?(target: Element): boolean;
  change?(target: Element): void;
  submit?(event: Event): void;
}

export interface SettingsHost {
  box(id: string): HTMLElement | null;
  paint(id: string, html: string): void;
  focusTo(id: string, selector?: string | null): void;
  land(id: string, selector?: string | null, from?: Element | null): void;
  pend<T>(key: string, page: string, render: () => void, work: () => Promise<T>, from?: Element | null): Promise<T>;
  neighbour(from: Element | null, row: string, attr: string): string | null;
  sel(attr: string, value: string): string;
  errHtml(text?: string | null): string;
  waits(key: string): string;
  when(iso: string): string;
}

declare module "../../core/kernel/types" {
  interface Services {
    settings: SettingsHost & { bindPage(id: string, page: SettingsPage): () => void };
  }
}
