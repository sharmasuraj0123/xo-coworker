/**
 * XO session identity for backend calls.
 *
 * The backend is multi-tenant: every Composio call must name a real XO user, or
 * it 401s. The browser carries that identity as an opaque session id in the
 * `X-XO-Session` header.
 *
 * A dedicated header, not `Authorization` — in remote-tunnel mode that one
 * already holds the tunnel's own bearer, and the two must not collide.
 *
 * Where the id comes from:
 *   - `GET /xo-auth/session/self` — the backend mints one for the XO credential
 *     it already holds (XO_API_KEY or a consumed token). This is the bootstrap
 *     for local/desktop, which has no XO login of its own.
 *   - Once a real per-user login exists, call `POST /xo-auth/session` with the
 *     user's XO token instead and hand the result to `setXoSessionId()`. Nothing
 *     else in the app changes.
 *
 * The mint is memoised: one in-flight request at most, result cached in
 * sessionStorage so a reload doesn't re-mint. A failure is not cached — the next
 * call retries, so a backend that boots slower than the UI recovers on its own.
 */

import { IS_DESKTOP, getBackendUrl } from "./constants";
import { getRemoteConfig } from "./remote-connection";

const STORAGE_KEY = "xo_session_id";

/** Header the backend reads identity from (services/composio/identity.py). */
export const XO_SESSION_HEADER = "X-XO-Session";

const SELF_MINT_PATH = "/xo-auth/session/self";

let inFlight: Promise<string | null> | null = null;

function readCached(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeCached(sessionId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionId) window.sessionStorage.setItem(STORAGE_KEY, sessionId);
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / quota — in-memory memoisation still applies */
  }
}

/**
 * Store a session id minted elsewhere (e.g. a real per-user login flow).
 * Overrides whatever the bootstrap produced.
 */
export function setXoSessionId(sessionId: string | null): void {
  writeCached(sessionId);
  inFlight = sessionId ? Promise.resolve(sessionId) : null;
}

/** Drop the cached id, e.g. after a 401. The next call re-mints. */
export function clearXoSessionId(): void {
  writeCached(null);
  inFlight = null;
}

async function mintFromBackend(): Promise<string | null> {
  // Plain fetch, never the `request()` wrapper in ./api — that wrapper calls
  // back into this module for its header and would recurse.
  const remoteConfig = getRemoteConfig();
  let url: string;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (remoteConfig) {
    url = `${remoteConfig.url}${SELF_MINT_PATH}`;
    headers["Authorization"] = `Bearer ${remoteConfig.token}`;
  } else if (IS_DESKTOP) {
    url = `${await getBackendUrl()}${SELF_MINT_PATH}`;
  } else {
    url = SELF_MINT_PATH;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    // 401 here means the backend itself holds no XO credential — a config
    // problem the user must fix (XO_API_KEY / consume flow), not a retry loop.
    console.warn(
      `[xo-session] ${SELF_MINT_PATH} -> ${res.status}; backend calls will run unauthenticated`,
    );
    return null;
  }
  const body = (await res.json()) as { session_id?: string };
  return body.session_id || null;
}

/**
 * Resolve this browser's session id, minting one if needed.
 * Returns null when no identity can be established.
 */
export async function getXoSessionId(): Promise<string | null> {
  const cached = readCached();
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = mintFromBackend()
    .then((sessionId) => {
      if (sessionId) writeCached(sessionId);
      // Only a success is memoised; a null lets the next caller retry.
      else inFlight = null;
      return sessionId;
    })
    .catch((err) => {
      console.warn("[xo-session] mint failed:", err);
      inFlight = null;
      return null;
    });

  return inFlight;
}

/** `{ "X-XO-Session": id }`, or `{}` when there's no identity to send. */
export async function xoSessionHeaders(): Promise<Record<string, string>> {
  const sessionId = await getXoSessionId();
  return sessionId ? { [XO_SESSION_HEADER]: sessionId } : {};
}
