// @ts-check

// The app's one kernel, with the shell's places defined before anything contributes to them.

import { createKernel } from "../core/kernel/index.js";
import { createFailureReporting } from "./failures.js";
import { definePlaces } from "./places.js";

const reporting = createFailureReporting();
export const failureModule = reporting.module;
export const kernel = createKernel({ warn: reporting.warn });
definePlaces(kernel);
