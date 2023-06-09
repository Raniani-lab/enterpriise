/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

patch(PaymentScreen.prototype, "l10n_de_pos_cert.PaymentScreen", {
    //@Override
    setup() {
        this._super(...arguments);
        if (this.pos.isCountryGermanyAndFiskaly()) {
            const _super_handlePushOrderError = this._handlePushOrderError.bind(this);
            this._handlePushOrderError = async (error) => {
                if (error.code === "fiskaly") {
                    const message = {
                        noInternet: this.env._t("Cannot sync the orders with Fiskaly!"),
                        unknown: this.env._t(
                            "An unknown error has occurred! Please contact Odoo for more information."
                        ),
                    };
                    this.pos.fiskalyError(error, message);
                } else {
                    _super_handlePushOrderError(error);
                }
            };
            this.validateOrderFree = true;
        }
    },
    //@override
    async validateOrder(isForceValidate) {
        if (this.pos.isCountryGermanyAndFiskaly()) {
            if (this.validateOrderFree) {
                this.validateOrderFree = false;
                try {
                    await this._super(...arguments);
                } finally {
                    this.validateOrderFree = true;
                }
            }
        } else {
            await this._super(...arguments);
        }
    },
    //@override
    async _finalizeValidation() {
        const _super = this._super;
        if (this.pos.isCountryGermanyAndFiskaly()) {
            if (this.currentOrder.isTransactionInactive()) {
                try {
                    await this.currentOrder.createTransaction();
                } catch (error) {
                    if (error.status === 0) {
                        this.pos.showFiskalyNoInternetConfirmPopup(this);
                    } else {
                        const message = {
                            unknown: this.env._t(
                                "An unknown error has occurred! Please, contact Odoo."
                            ),
                        };
                        this.pos.fiskalyError(error, message);
                    }
                }
            }
            if (this.currentOrder.isTransactionStarted()) {
                try {
                    await this.currentOrder.finishShortTransaction();
                    await _super(...arguments);
                } catch (error) {
                    if (error.status === 0) {
                        this.pos.showFiskalyNoInternetConfirmPopup(this);
                    } else {
                        const message = {
                            unknown: this.env._t(
                                "An unknown error has occurred! Please, contact Odoo."
                            ),
                        };
                        this.pos.fiskalyError(error, message);
                    }
                }
            }
        } else {
            await _super(...arguments);
        }
    },
});
