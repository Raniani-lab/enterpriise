/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { AddInfoPopup } from "@l10n_mx_edi_pos/add_info_popup/add_info_popup";
import { patch } from "@web/core/utils/patch";


patch(PaymentScreen.prototype, "l10n_mx_edi_pos.PaymentScreen", {
    setup() {
        this._super(...arguments);
        this.isMxEdiPopupOpen = false;
    },
    //@override
    async toggleIsToInvoice() {
        const _super = this._super;
        if (this.pos.company.country?.code === 'MX' && !this.currentOrder.is_to_invoice()) {
            const { confirmed, payload } = await this.popup.add(AddInfoPopup);
            if (confirmed) {
                this.currentOrder.l10n_mx_edi_cfdi_to_public = (payload.l10n_mx_edi_cfdi_to_public === true || payload.l10n_mx_edi_cfdi_to_public === '1');
                this.currentOrder.l10n_mx_edi_usage = payload.l10n_mx_edi_usage;
            } else {
                this.currentOrder.set_to_invoice(!this.currentOrder.is_to_invoice());
            }
        }
        _super(...arguments);
    },
    areMxFieldsVisible() {
        return this.pos.company.country?.code === 'MX' && this.currentOrder.is_to_invoice();
    },
});
