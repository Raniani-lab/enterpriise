/** @odoo-module */

import PaymentScreen from "@point_of_sale/js/Screens/PaymentScreen/PaymentScreen";
import Registries from "@point_of_sale/js/Registries";

const PosDeResPaymentScreen = (PaymentScreen) =>
    class extends PaymentScreen {
        //@Override
        async _finalizeValidation() {
            if (this.env.pos.isRestaurantCountryGermanyAndFiskaly()) {
                try {
                    await this.currentOrder.retrieveAndSendLineDifference();
                } catch {
                    // do nothing with the error
                }
            }
            await super._finalizeValidation(...arguments);
        }
    };

Registries.Component.extend(PaymentScreen, PosDeResPaymentScreen);

export default PosDeResPaymentScreen;
