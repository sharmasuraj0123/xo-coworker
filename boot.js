// @ts-check
export {};

try {
  await import("./shell/frame.js");
  await import("./js/app.js");
} catch (error) {
  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  const message = document.createElement("p");
  message.textContent = "Coworker couldn't start. Reload the page to try again.";
  alert.append(message);
  document.body.replaceChildren(alert);
  console.error("Coworker startup failed", error);
}
