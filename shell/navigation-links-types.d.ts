import type { NavigationOptions } from "./navigation-types.d.ts";
import type { Notice } from "../core/services/notices.js";

export interface NavigationLinks {
  go(view: string, options: NavigationOptions): void;
  showMsg(id: string): void;
  openFromPanel(view: string, event: MouseEvent): void;
  thread(id: string): unknown;
  heraldShow(notice: Notice, ms: number): void;
}
