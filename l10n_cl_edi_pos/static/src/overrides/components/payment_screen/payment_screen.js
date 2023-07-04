/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { TextAreaPopup } from "@point_of_sale/app/utils/input_popups/textarea_popup";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

patch(PaymentScreen.prototype, "l10n_cl_edi_pos.PaymentScreen", {
    toggleIsToInvoice() {
        if (this.pos.isChileanCompany()) {
            if (this.currentOrder.invoiceType == "boleta") {
                this.currentOrder.invoiceType = "factura";
            } else {
                this.currentOrder.invoiceType = "boleta";
            }
            this.render(true);
        } else {
            this._super(...arguments);
        }
    },
    highlightInvoiceButton() {
        if (this.pos.isChileanCompany()) {
            return this.currentOrder.isFactura();
        }
        return this.currentOrder.is_to_invoice();
    },
    async _isOrderValid(isForceValidate) {
        const result = await this._super(...arguments);
        if (this.pos.isChileanCompany()) {
            if (!result) {
                return false;
            }
            if (
                this.currentOrder._isRefundOrder() &&
                this.currentOrder.get_partner().id === this.pos.consumidorFinalAnonimoId
            ) {
                this.popup.add(ErrorPopup, {
                    title: _t("Refund not possible"),
                    body: _t("You cannot refund orders for the Consumidor Final Anònimo."),
                });
                return false;
            }
            const mandatoryFacturaFields = [
                "l10n_cl_dte_email",
                "l10n_cl_activity_description",
                "street",
            ];
            const missingFields = [];
            const partner = this.currentOrder.get_partner();
            if (this.currentOrder.invoiceType == "factura" || this.currentOrder._isRefundOrder()) {
                for (const field of mandatoryFacturaFields) {
                    if (!partner[field]) {
                        missingFields.push(field);
                    }
                }
            }
            if (missingFields.length > 0) {
                this.notification.add(
                    this.env._t("Please fill out missing fields to proceed.", 5000)
                );
                this.selectPartner(true, missingFields);
                return false;
            }
            return true;
        }
        return result;
    },
    async validateOrder(isForceValidate) {
        const _super = this._super;
        if (
            this.pos.isChileanCompany() &&
            this.paymentLines.some((line) => line.payment_method.is_card_payment)
        ) {
            const { confirmed, payload } = await this.popup.add(TextAreaPopup, {
                confirmText: this.env._t("Confirm"),
                cancelText: this.env._t("Cancel"),
                title: this.env._t("Please register the voucher number"),
            });

            if (!confirmed) {
                return;
            }
            this.currentOrder.voucherNumber = payload;
        }
        await _super(arguments);
    },
});
