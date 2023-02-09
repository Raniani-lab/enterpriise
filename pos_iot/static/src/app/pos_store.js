/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/pos_store";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import { _t } from "@web/core/l10n/translation";
import { PaymentScreen } from "@point_of_sale/js/Screens/PaymentScreen/PaymentScreen";

patch(PosStore.prototype, "pos_iot.PosStore", {
    showScreen() {
        if (
            this.mainScreen.component === PaymentScreen &&
            this.globalState
                .get_order()
                .paymentlines.some(
                    (pl) =>
                        pl.payment_method.use_payment_terminal === "worldline" &&
                        ["waiting", "waitingCard", "waitingCancel"].includes(pl.payment_status)
                )
        ) {
            this.popup.add(ErrorPopup, {
                title: _t("Transaction in progress"),
                body: _t("Please process or cancel the current transaction."),
            });
        } else {
            return this._super(...arguments);
        }
    },
    connect_to_proxy() {
        this.globalState.env.proxy.ping_boxes();
        if (this.globalState.config.iface_scan_via_proxy) {
            this.globalState.env.barcode_reader.connect_to_proxy();
        }
        if (this.globalState.config.iface_print_via_proxy) {
            this.globalState.env.proxy.connect_to_printer();
        }
        if (!this.globalState.env.proxy.status_loop_running) {
            this.globalState.env.proxy.status_loop();
        }
        return Promise.resolve();
    },
});
