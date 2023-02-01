/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { Chrome } from "@point_of_sale/js/Chrome";

patch(Chrome.prototype, "pos_iot.Chrome", {
    connect_to_proxy() {
        this.env.proxy.ping_boxes();
        if (this.env.pos.config.iface_scan_via_proxy) {
            this.env.barcode_reader.connect_to_proxy();
        }
        if (this.env.pos.config.iface_print_via_proxy) {
            this.env.proxy.connect_to_printer();
        }
        if (!this.env.proxy.status_loop_running) {
            this.env.proxy.status_loop();
        }
        return Promise.resolve();
    },
});
