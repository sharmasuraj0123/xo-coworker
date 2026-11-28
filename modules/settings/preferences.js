// @ts-check
import { createDeviceNotice } from "./device-notice.js";
import { wireAppearance, wireChatBubbles, wireMessageHops, wireWebPictures } from "./appearance.js";

/** @import { PreferenceScope, Preferences } from "./appearance-types.d.ts" */

/** @param {PreferenceScope} scope @param {Preferences} prefs @param {(text: string) => void} announce */
export function mountPreferences(scope, { THEME, shape, webPictures }, announce) {
  const deviceSaid = createDeviceNotice(announce);
  wireAppearance(scope, { THEME, deviceSaid });
  wireChatBubbles(scope, deviceSaid);
  const renderHops = wireMessageHops(scope, shape, deviceSaid);
  const renderPictures = wireWebPictures(scope, shape, webPictures, deviceSaid);
  scope.effect(() => shape.onChange(() => { renderHops(); renderPictures(); }));
  renderPictures();
}
