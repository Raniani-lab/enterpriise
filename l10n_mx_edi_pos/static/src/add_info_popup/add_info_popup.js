/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/js/Popups/AbstractAwaitablePopup";
import { usePos } from "@point_of_sale/app/pos_hook";

const { useState } = owl;

export class AddInfoPopup extends AbstractAwaitablePopup {
    static template = "l10n_mx_edi_pos.AddInfoPopup"

    setup() {
        super.setup();
        this.pos = usePos();
        // when opening the popup for the first time, both variables are undefined !
        this.state = useState({
            l10n_mx_edi_usage: this.pos.globalState.selectedOrder.l10n_mx_edi_usage === undefined ? 'G01' : this.pos.globalState.selectedOrder.l10n_mx_edi_usage,
            l10n_mx_edi_cfdi_to_public: !!this.pos.globalState.selectedOrder.l10n_mx_edi_cfdi_to_public,
        });
    }

    async getPayload() {
        return this.state;
    }
}
