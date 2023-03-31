/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/js/Screens/PaymentScreen/PaymentScreen";
import { patch } from "@web/core/utils/patch";

patch(PaymentScreen.prototype, "l10n_de_pos_res_cert.PaymentScreen", {
    //@Override
    async _finalizeValidation() {
        const _super = this._super;
        if (this.pos.globalState.isRestaurantCountryGermanyAndFiskaly()) {
            try {
                await this.currentOrder.retrieveAndSendLineDifference();
            } catch {
                // do nothing with the error
            }
        }
        await _super(...arguments);
    },
});
