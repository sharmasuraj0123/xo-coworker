// @ts-check

/** @import { Case } from "../lib/types.d.ts" */
import { readFileSync } from "node:fs";

export const deferUntilAppsGate = "Apps not registered at boot in release or P1; returns at the Apps gate";

const basic = JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8"));
const HELLO = "/home/me/xo-apps/hello";
const apps = { packages: { [HELLO]: "e2e/fixtures/apps/hello" }, answers: { hello_greet: "Hello, {name}." } };

/** demo open, then Settings › Apps. @param {import("../lib/types.d.ts").Tools} t */
async function appsPage(t) {
  const { page } = t;
  await t.open();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await t.settle();
  await page.getByRole("complementary", { name: "Navigation" }).getByRole("button", { name: "Settings" }).click();
  await t.settle();
  const settings = page.getByRole("dialog");
  await settings.getByRole("tab", { name: "Apps" }).click();
  await t.settle();
  return settings;
}

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
    name: "an app installs from a folder after the owner's OK", seed: { ...basic, apps },
    async run(t) {
      const settings = await appsPage(t);
      await settings.getByRole("button", { name: "Install an app" }).click();
      await settings.getByRole("radio", { name: "A folder on this machine (development)" }).check();
      await t.settle();
      await settings.getByRole("textbox", { name: "Folder" }).fill(HELLO);
      await settings.getByRole("button", { name: "Check it" }).click();
      await t.settle();
      if (!(await settings.getByRole("heading", { name: "Install Hello?" }).count())) t.fail("the consent sheet didn't open");
      if (!(await settings.getByText("Change files in **/*.hello").count())) t.fail("the sheet doesn't say what it may change");
      if (!(await settings.getByText("Can reach the internet (through XO's proxy).").count())) t.fail("the sheet doesn't say the app can reach the internet");
      await settings.getByRole("button", { name: "Install", exact: true }).click();
      await t.settle();
      if (t.space.store.apps.installed.size) t.fail("the app was installed before the owner's answer");
      await owner(t, "Install Hello 0.1.0");
      await settings.getByRole("heading", { name: "Hello", exact: true }).waitFor({ timeout: 6000 }).catch(() => t.fail("the app's page didn't open after the OK"));
      if (!t.space.store.apps.installed.has("dev.xo-apps.hello")) t.fail("Allow didn't install it");
    },
  },
  {
    name: "an installed app turns on in a project after the owner's OK and its panel greets", seed: { ...basic, apps: { ...apps, installed: [HELLO] } },
    async run(t) {
      const { page } = t;
      const settings = await appsPage(t);
      await settings.getByRole("button", { name: "Open Hello" }).click();
      await t.settle();
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
      await view.getByRole("status").getByText("Hello, Ana.", { exact: true }).waitFor({ timeout: 6000 }).catch(async () => t.fail(`the panel said "${await view.getByRole("status").textContent()}", not "Hello, Ana."`));
      const calls = t.space.store.writes.filter((w) => w.path === "/api/coworker/apps/dev.xo-apps.hello/call");
      if (calls.length !== 1) t.fail(`${calls.length} tool calls reached the Space, not 1`);
    },
  },
];
