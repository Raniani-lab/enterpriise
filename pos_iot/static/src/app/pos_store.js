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
    connectToProxy() {
        this.hardwareProxy.pingBoxes();
        if (this.globalState.config.iface_scan_via_proxy) {
            this.barcodeReader?.connectToProxy();
        }
        if (this.globalState.config.iface_print_via_proxy) {
            this.hardwareProxy.connectToPrinter();
        }
        if (!this.hardwareProxy.statusLoopRunning) {
            this.hardwareProxy.statusLoop();
        }
        return Promise.resolve();
    },
});
