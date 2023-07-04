/** @odoo-module */

import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";

patch(TicketScreen.prototype, "l10n_de_pos_cert.TicketScreen", {
    // @Override
    async _onBeforeDeleteOrder(order) {
        const _super = this._super;
        try {
            if (this.pos.isCountryGermanyAndFiskaly() && order.isTransactionStarted()) {
                await order.cancelTransaction();
            }
            return _super(...arguments);
        } catch (error) {
            this._triggerFiskalyError(error);
            return false;
        }
    },
    _triggerFiskalyError(error) {
        const message = {
            noInternet: this.env._t(
                "Check the internet connection then try to validate or cancel the order. " +
                    "Do not delete your browsing, cookies and cache data in the meantime!"
            ),
            unknown: this.env._t(
                "An unknown error has occurred! Try to validate this order or cancel it again. " +
                    "Please contact Odoo for more information."
            ),
        };
        this.pos.fiskalyError(error, message);
    },
});
