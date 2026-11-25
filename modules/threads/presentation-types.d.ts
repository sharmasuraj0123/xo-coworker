import type * as status from "./status.js";
import type { threadLabelInput, threadTitleInput } from "./editing.js";
import type { threadsCtl } from "./header.js";

export type ThreadPresentation = Pick<typeof status, "glyphOf" | "isBusy" | "isHeld" | "stOf" | "wordOf"> & {
  threadTitleInput: typeof threadTitleInput;
  threadLabelInput: typeof threadLabelInput;
  threadsCtl: typeof threadsCtl;
};
declare module "../../core/kernel/types" {
  interface Services { threadPresentation: ThreadPresentation }
}

declare module "../../core/kernel/types" {
  interface Services {
    threadControls: ReturnType<typeof import("./controls.js").createThreadControls>;
    threadMenu: ReturnType<typeof import("./menu.js").createThreadMenu>;
    threadActions: {
      closeMenu: ReturnType<typeof import("./editing.js").createThreadEditing>["closeThreadMenu"];
      renderDelete: ReturnType<typeof import("./delete.js").createThreadDelete>["render"];
    };
  }
}
