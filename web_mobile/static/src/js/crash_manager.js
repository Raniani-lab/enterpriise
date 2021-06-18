/** @odoo-module */

import { registry } from "@web/core/registry";
import mobile from "web_mobile.core";

function mobileErrorHandler() {
    return (error) => {
        if (mobile.methods.crashManager) {
            mobile.methods.crashManager(error);
        }
    };
}
registry
    .category("error_handlers")
    .add("web_mobile.errorHandler", mobileErrorHandler, { sequence: 3 });
