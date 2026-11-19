# Apps use xo-space's local routes, not a oneshot completion

- **Decided:** 19 Nov 2026, 19:10Z, by the owner: "we won't expose oneshot … the app can use local routes".
- **Rule:**
  - An app that needs a model does what xo-coworker does: it uses a chat or thread through xo-space's local routes.
  - It calls them through the apps-host's route proxy. Routes must be declared in the app's manifest and granted per project. Every call is stamped as the app.
  - Secret-value and raw-file routes are never forwarded.
- **Consequence:** the route contract is the app API, so it is versioned and checked against xo-space's OpenAPI.
