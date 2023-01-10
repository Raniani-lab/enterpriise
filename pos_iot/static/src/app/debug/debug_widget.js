/** @odoo-module */

import { DebugWidget } from "@point_of_sale/app/debug/debug_widget";
import { patch } from "@web/core/utils/patch";

patch(DebugWidget, "pos_iot.DebugWidget", {
    /**
     * @override
     */
    refreshDisplay() {
        if (this.env.proxy.display) {
            this.env.proxy.display.action({ action: "display_refresh" });
        }
    },
});
