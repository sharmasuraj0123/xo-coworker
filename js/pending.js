// A control that starts a request answers once until the request settles (Astra: Settings choices, Connect, Revoke,
// Remove, Disconnect … each took two Enters as two requests).
//
//   once(key, work)   runs work() unless the same key is already in flight, in which case it returns that same
//                     promise: a second press, a repeated Enter, a double click, or the control drawn again with the
//                     same key while the first is out, all join the first request instead of sending another.
//   isPending(key)    for the redraw: the control drawn while its request is out says so (busyAttrs).
//   busyAttrs(key)    ' aria-busy="true" aria-disabled="true"' while in flight, else "". aria-disabled, not disabled:
//                     the control keeps focus and stays in the Tab order while it waits.
//
// What happens after is the caller's, by contract: a failure keeps what the person typed (the draft) and leaves a
// retry that works (the key is free again as soon as the request settles); a success says so and sends focus where
// the control's contract says.
const inflight = new Map();
export const isPending = (key) => inflight.has(key);
export const busyAttrs = (key) => (inflight.has(key) ? ' aria-busy="true" aria-disabled="true"' : "");
export function once(key, work) {
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve().then(work).finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
  inflight.set(key, p);
  return p;
}
