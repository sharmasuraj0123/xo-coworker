// @ts-check

// The app's one kernel, with the shell's places defined before anything contributes to them.

import { createKernel } from "../core/kernel/index.js";
import { createFailureReporting } from "./failures.js";
import { definePlaces } from "./places.js";

export function createShellKernel() {
  const reporting = createFailureReporting();
  const kernel = createKernel({ warn: reporting.warn });
  definePlaces(kernel);
  kernel.register(reporting.module);
  return kernel;
}
