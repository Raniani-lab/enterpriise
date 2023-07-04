/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

patch(PaymentScreen.prototype, "l10n_de_pos_res_cert.PaymentScreen", {
    //@Override
    async _finalizeValidation() {
        const _super = this._super;
        if (this.pos.isRestaurantCountryGermanyAndFiskaly()) {
            try {
                await this.currentOrder.retrieveAndSendLineDifference();
            } catch {
                // do nothing with the error
            }
        }
        await _super(...arguments);
    },
});
