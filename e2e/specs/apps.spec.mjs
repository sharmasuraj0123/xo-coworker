// @ts-check

/** @import { Case } from "../lib/types.d.ts" */
import { readFileSync } from "node:fs";

// An app from its own folder: installed from Settings › Apps after the owner's OK, turned on in a project, and its panel answers.

const basic = JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8"));
const seed = { ...basic, apps: { packages: { "/home/me/xo-apps/hello": "e2e/fixtures/apps/hello" }, answers: { hello_greet: "Hello, {name}." } } };

/** Nothing applies until the owner answers in Needs you; the case answers as the owner would. @param {import("../lib/types.d.ts").Tools} t @param {string} title */
async function owner(t, title) {
  if (!(await t.page.getByRole("dialog").getByText("Waiting for your approval in Needs you").count())) t.fail(`"${title}" didn't wait for the owner's approval`);
  const ids = t.space.store.apps.pendingIds();
  if (ids.length !== 1 || t.space.store.apps.approvals.get(ids[0])?.title !== title) t.fail(`expected one pending approval "${title}", got ${ids.length}`);
  else t.space.store.apps.answer(ids[0], "allow");
  await t.settle();
}

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "an app installs from a folder, turns on in a project and its panel greets", seed,
    async run(t) {
      const { page } = t;
      await t.open();
      await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
      await t.settle();
      await page.getByRole("complementary", { name: "Navigation" }).getByRole("button", { name: "Settings" }).click();
      await t.settle();
      const settings = page.getByRole("dialog");
      await settings.getByRole("tab", { name: "Apps" }).click();
      await t.settle();
      await settings.getByRole("button", { name: "Install an app" }).click();
      await settings.getByRole("radio", { name: "A folder on this machine (development)" }).check();
      await t.settle();
      await settings.getByRole("textbox", { name: "Folder" }).fill("/home/me/xo-apps/hello");
      await settings.getByRole("button", { name: "Check it" }).click();
      await t.settle();
      if (!(await settings.getByRole("heading", { name: "Install Hello?" }).count())) t.fail("the consent sheet didn't open");
      if (!(await settings.getByText("Change files in **/*.hello").count())) t.fail("the sheet doesn't say what it may change");
      if (!(await settings.getByText("Can reach the internet (through XO's proxy).").count())) t.fail("the sheet doesn't say the app can reach the internet");
      await settings.getByRole("button", { name: "Install", exact: true }).click();
      await t.settle();
      await owner(t, "Install Hello 0.1.0");
      if (!(await settings.getByRole("heading", { name: "Hello", exact: true }).count())) t.fail("the app's page didn't open after the OK");
      await settings.getByRole("button", { name: "Turn on" }).click();
      await t.settle();
      await settings.getByRole("button", { name: "Allow" }).click();
      await t.settle();
      await owner(t, "Turn Hello on in demo");
      await settings.getByRole("button", { name: "Open Hello in demo" }).click();
      await page.keyboard.press("Escape");
      await t.settle();
      const view = page.frameLocator('iframe[title="Hello: Hello"]');
      await view.getByRole("textbox", { name: "Name" }).fill("Ana");
      await view.getByRole("button", { name: "Say hello" }).click();
      await t.settle();
      const said = await view.getByRole("status").textContent();
      if (said !== "Hello, Ana.") t.fail(`the panel said "${said}", not "Hello, Ana."`);
      const calls = t.space.store.writes.filter((w) => w.path === "/api/coworker/apps/dev.xo-apps.hello/call");
      if (calls.length !== 1) t.fail(`${calls.length} tool calls reached the Space, not 1`);
    },
  },
];
