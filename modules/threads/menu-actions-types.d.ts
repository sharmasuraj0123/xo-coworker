import type { createScope } from "../../core/kernel/scope.js";
import type { createThreadControls } from "./controls.js";
import type { createThreadDelete } from "./delete.js";
import type { createThreadEditing } from "./editing.js";
import type { createThreadMenuNavigation } from "./menu-navigation.js";

type Navigation = Parameters<typeof createThreadMenuNavigation>[0];

export type ThreadMenuActions = Pick<Navigation, "thread" | "go" | "showThread"> & {
  controls: ReturnType<typeof createThreadControls>;
  editing: ReturnType<typeof createThreadEditing>;
  deletion: ReturnType<typeof createThreadDelete>;
  scope: Pick<ReturnType<typeof createScope>, "frame" | "signal">;
  resolve(id: string, next: boolean): unknown;
  openOtherRuntime(): boolean;
  closePage(): unknown;
  render(): void;
  schedule(): void;
  heraldShow(notice: { kind: "done" | "stopped"; text: string; sub: string }, duration: number): void;
};
