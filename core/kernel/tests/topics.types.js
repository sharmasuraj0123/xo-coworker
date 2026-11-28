// @ts-check

/** @import { Bus, ModuleContext } from "../types" */

/** @param {Bus} bus @param {ModuleContext} context */
export function appTopicTypeChecks(bus, context) {
  bus.emit("app:pagehide");
  bus.emit("app:view-leaving", { from: "home", to: "ws" });
  bus.once("app:view-leaving", (event) => event.to.toUpperCase());
  context.on("app:conversation-header", ({ needs }) => needs.map(({ t }) => t.id));
  context.emit("app:render");
  context.emit("settings:page-open", "keys");
  context.emit("extension:data", { value: 1 });
  const pagehide = /** @type {const} */ (["app:pagehide"]);

  const leaving = /** @type {const} */ (["app:view-leaving", { from: "home", to: "ws" }]);
  const publication = Math.random() < 0.5 ? pagehide : leaving;
  bus.emit(...publication);
  const topic = publication[0];
  bus.on(topic, (payload) => payload?.to.toUpperCase());

  // @ts-expect-error Misspelled app topics cannot fall back to extension topics.
  bus.emit("app:page-hide");
  // @ts-expect-error A view transition requires the destination.
  bus.emit("app:view-leaving", { from: "home" });
  // @ts-expect-error A header publication requires its context.
  context.emit("app:conversation-header");
  // @ts-expect-error A payload-free topic accepts no payload.
  context.emit("app:render", {});
  // @ts-expect-error Opening a Settings page publishes its ID.
  context.emit("settings:page-open", { id: "keys" });
  // @ts-expect-error A union topic must travel with its own payload.
  bus.emit(topic);
  // @ts-expect-error This payload does not belong to all members of the topic union.
  context.emit(topic, { from: "home", to: "ws" });
  const possibleTypo = Math.random() < 0.5 ? "app:pagehide" : "app:page-hide";
  // @ts-expect-error Each app topic in a subscription union must be registered.
  bus.on(possibleTypo, () => {});

  const wrongListener = (/** @type {{ from: number }} */ event) => event.from;

  // @ts-expect-error The listener must accept the published payload.
  context.on("app:view-leaving", wrongListener);
  // @ts-expect-error The subscriber cannot misspell an app topic.
  context.on("app:conversation-heder", () => {});
}
