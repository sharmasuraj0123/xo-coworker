# Apps reach the public internet through xo-space's egress proxy

- **Decided:** 19 Nov 2026, 20:19:56Z, by the owner, in review `rv_a0f6ecd86521488c`. This confirms xo-space's app-host design v2.
- **Rule:**
  - An app's server reaches the public internet only through xo-space's egress proxy, never directly.
  - Local routes still go through the route proxy (declared in the manifest, granted per project, stamped as the app).
  - Views have no network of their own. They call their server's tools through the bridge.
- **Replaces:** the 4 Nov contract's per-host `network: {hosts: [...]}` grant.
