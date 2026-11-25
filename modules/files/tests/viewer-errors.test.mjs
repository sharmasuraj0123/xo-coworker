// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../../../core/platform/api.js";
import { settle } from "../../../tests/lib/dom.mjs";
import { projectFile, unavailable, viewerFixture } from "./viewer-fixture.mjs";

test("each viewer body shows the download error once beneath its controls", async () => {
  const path = "note.html";
  const change = { path, base: "base", scope: { key: "demo|", project: "demo", worktree: null }, file: { path } };
  const { viewer, host, click } = await viewerFixture({
    tabs: () => '<nav aria-label="Stage sections"></nav>',
    changes: { at: () => change, patchAt: async () => "patch" },
  }, {
    diff: async (region) => {
      region.append(region.ownerDocument.createElement("article"));
      return { update() {}, split() {}, destroy() {} };
    },
  });
  api.projectFile = async () => ({ kind: "html", content: "<p>Note</p>", version: "1" });
  api.projectVersions = async () => ({
    versions: [{ id: "2", version: "1", at: "2026-11-25T00:00:00Z" }, { id: "1", version: "0", at: "2026-11-24T00:00:00Z" }],
  });
  let downloads = 0;
  api.projectDownload = async () => { throw new Error(`Download refused (${++downloads})`); };
  viewer.open({ ...unavailable(), pin: true });
  viewer.open(projectFile(path));
  await settle();

  /** @param {string} bodySelector @param {boolean} versionsVisible */
  async function refused(bodySelector, versionsVisible) {
    const expected = downloads + 1;
    click("[data-vw-more]");
    click(".vw-menu [data-vw-download]");
    await settle();
    const alerts = host.querySelectorAll('.vw-cut[role="alert"]');
    assert.equal(alerts.length, 1);
    const [alert] = alerts;
    assert.equal(downloads, expected);
    assert.equal(alert.querySelector("span")?.textContent, `Download refused (${expected})`);
    const stages = host.querySelector('nav[aria-label="Stage sections"]');
    const files = host.querySelector('.vw-tabs[role="tablist"]');
    const heading = host.querySelector(".vw-top");
    const versions = host.querySelector(".vw-verbar");
    const body = host.querySelector(bodySelector);
    assert.ok(stages && files && heading && body, bodySelector);
    assert.equal(!!versions, versionsVisible);
    const children = [...host.children];
    const order = [stages, files, heading, ...(versions ? [versions] : []), alert, body];
    assert.ok(order.every((element, index) => index === 0 || children.indexOf(element) > children.indexOf(order[index - 1])));
  }

  try {
    await refused(".vw-body.is-frame", true);
    click(".vw-seg [data-vw-mode=source]");
    await settle();
    await refused(".vw-body.vw-doc", true);
    click(".vw-seg [data-vw-show=changes]");
    await settle();
    await refused(".vw-diff", false);
  } finally {
    viewer.close();
  }
});
