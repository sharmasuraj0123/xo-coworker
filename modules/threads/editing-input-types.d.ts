import type { createScope } from "../../core/kernel/scope.js";
import type { EditDeps, EditField, ThreadEdit } from "./editing-types.d.ts";

export interface EditInput {
  scope: ReturnType<typeof createScope>;
  controls: EditDeps["controls"];
  endThreadEdit(edit: ThreadEdit): void;
  saveThreadField(id: string, field: EditField, value: string): Promise<void>;
  closeThreadMenu(): void;
}
