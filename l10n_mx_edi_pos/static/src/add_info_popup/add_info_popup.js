/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/js/Popups/AbstractAwaitablePopup";
const { useState } = owl;

export class AddInfoPopup extends AbstractAwaitablePopup {
    static template = "l10n_mx_edi_pos.AddInfoPopup"

    setup() {
        super.setup();
        // when opening the popup for the first time, both variables are undefined !
        this.state = useState({
            l10n_mx_edi_usage: this.env.pos.selectedOrder.l10n_mx_edi_usage === undefined ? 'G01' : this.env.pos.selectedOrder.l10n_mx_edi_usage,
            l10n_mx_edi_cfdi_to_public: !!this.env.pos.selectedOrder.l10n_mx_edi_cfdi_to_public,
        });
    }

    async getPayload() {
        return this.state;
    }
}
