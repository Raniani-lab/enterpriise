/** @odoo-module */

import TicketScreen from "@point_of_sale/js/Screens/TicketScreen/TicketScreen";
import Registries from "@point_of_sale/js/Registries";

const PosDeTicketScreen = (TicketScreen) =>
    class extends TicketScreen {
        // @Override
        async _onBeforeDeleteOrder(order) {
            try {
                if (this.env.pos.isCountryGermanyAndFiskaly() && order.isTransactionStarted()) {
                    await order.cancelTransaction();
                }
                return super._onBeforeDeleteOrder(...arguments);
            } catch (error) {
                this._triggerFiskalyError(error);
                return false;
            }
        }
        _triggerFiskalyError(error) {
            const message = {
                noInternet: this.env._t(
                    "Check the internet connection then try to validate or cancel the order. " +
                        "Do not delete your browsing, cookies and cache data in the meantime !"
                ),
                unknown: this.env._t(
                    "An unknown error has occurred ! Try to validate this order or cancel it again. " +
                        "Please contact Odoo for more information."
                ),
            };
            this.trigger("fiskaly-error", { error, message });
        }
    };

Registries.Component.extend(TicketScreen, PosDeTicketScreen);

export default TicketScreen;
