/** @odoo-module **/

import { hasTouch } from "@web/core/browser/feature_detection";
import { startWebClient } from "@web/start";
import { WebClientEnterprise } from "./webclient/webclient";

/**
 * This file starts the enterprise webclient. In the manifest, it replaces
 * the community main.js to load a different webclient class
 * (WebClientEnterprise instead of WebClient)
 */

(async () => {
    await startWebClient(WebClientEnterprise);
    document.body.classList.toggle("o_touch_device", hasTouch());
})();
