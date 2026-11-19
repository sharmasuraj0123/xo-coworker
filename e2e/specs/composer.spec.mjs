// @ts-check

/** @import { Case, Tools } from "../lib/types.d.ts" */

// The composer: a draft stays with its conversation, on this device, and is never sent by switching away.

const openDemo = async (/** @type {Tools} */ t) => {
  await t.open();
  await t.page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await t.settle();
};

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "a draft stays with its conversation", seed: "basic",
    async run(t) {
      await openDemo(t);
      await t.page.getByRole("textbox", { name: "Message demo…" }).fill("half a thought");
      await t.settle();
      await t.page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Workspace" }).click();
      await t.settle();
      const ws = t.page.getByRole("main").getByRole("textbox").first();
      if ((await ws.inputValue()) !== "") t.fail(`the Workspace's field shows another conversation's draft: ${await ws.inputValue()}`);
      await t.page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
      await t.settle();
      const box = t.page.getByRole("textbox", { name: "Message demo…" });
      if ((await box.inputValue()) !== "half a thought") t.fail(`demo's draft didn't come back: ${JSON.stringify(await box.inputValue())}`);
      const kept = await t.page.evaluate(() => localStorage.getItem("cv-drafts:live"));
      if (!kept || JSON.parse(kept)["p:demo"] !== "half a thought") t.fail(`the draft isn't kept on this device: ${kept}`);
      if (t.store.writes.some((w) => w.method === "POST")) t.fail("a draft was sent");
    },
  },
];
