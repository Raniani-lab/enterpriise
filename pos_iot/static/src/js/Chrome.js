/** @odoo-module */

import core from "web.core";
import { patch } from "@web/core/utils/patch";
import { Chrome } from "@point_of_sale/js/Chrome";
import { Gui } from "@point_of_sale/js/Gui";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";

const _t = core._t;

patch(Chrome.prototype, "pos_iot.Chrome", {
    __showScreen() {
        if (
            this.pos.mainScreen.name === "PaymentScreen" &&
            this.env.pos
                .get_order()
                .paymentlines.some(
                    (pl) =>
                        pl.payment_method.use_payment_terminal === "worldline" &&
                        ["waiting", "waitingCard", "waitingCancel"].includes(pl.payment_status)
                )
        ) {
            Gui.showPopup(ErrorPopup, {
                title: _t("Transaction in progress"),
                body: _t("Please process or cancel the current transaction."),
            });
        } else {
            return this._super(...arguments);
        }
    },
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
