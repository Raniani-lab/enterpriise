/** @odoo-module **/

import { startWebClient } from "@web/start";
import { WebClientEnterprise } from "./webclient/webclient";

/**
 * This file starts the enterprise webclient. In the manifest, it replaces
 * the community main.js to load a different webclient class
 * (WebClientEnterprise instead of WebClient)
 */

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("/web/service-worker.js", { scope: "/web" })
        .then((registration) => {
            console.info("Registration successful, scope is:", registration.scope);
        })
        .catch((error) => {
            console.error("Service worker registration failed, error:", error);
        });
}

startWebClient(WebClientEnterprise);
