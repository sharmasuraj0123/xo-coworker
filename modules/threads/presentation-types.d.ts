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
