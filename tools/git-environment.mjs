// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** @param {string[]} args @param {import("node:child_process").SpawnSyncOptionsWithStringEncoding} options */
export function runGit(args, options) {
  const home = mkdtempSync(join(tmpdir(), "xo-git-home-"));
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
    return spawnSync("git", args, { ...options, env: {
      ...env, HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_GLOBAL: join(home, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1",
    } });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}
