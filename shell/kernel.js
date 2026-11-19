// @ts-check

// The app's one kernel, with the shell's places defined before anything contributes to them.

import { createKernel } from "../core/kernel/index.js";
import { definePlaces } from "./places.js";

export const kernel = createKernel();
definePlaces(kernel);
