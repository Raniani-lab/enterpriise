/** @odoo-module */

import { InvoiceButton } from "@point_of_sale/js/Screens/TicketScreen/ControlButtons/InvoiceButton";
import { AddInfoPopup } from "@l10n_mx_edi_pos/add_info_popup/add_info_popup";
import { patch } from "@web/core/utils/patch";

patch(InvoiceButton.prototype, "l10n_mx_edi_pos.InvoiceButton", {
    async onWillInvoiceOrder(order){
        if (this.pos.globalState.company.country.code !== 'MX') {
            return true;
        }
        const { confirmed, payload } = await this.popup.add(AddInfoPopup);
        if (confirmed) {
            order.l10n_mx_edi_cfdi_to_public = (payload.l10n_mx_edi_cfdi_to_public === true || payload.l10n_mx_edi_cfdi_to_public === '1');
            order.l10n_mx_edi_usage = payload.l10n_mx_edi_usage;
        }
        return confirmed;
    }
});
