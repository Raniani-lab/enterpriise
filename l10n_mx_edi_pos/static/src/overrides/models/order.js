/** @odoo-module */

import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(Order.prototype, "l10n_mx_edi_pos.Order", {
    //@Override
    export_as_JSON() {
        const json = this._super(...arguments);
        if (this.pos.company.country?.code === 'MX' && json['to_invoice']) {
            json['l10n_mx_edi_cfdi_to_public'] = this.l10n_mx_edi_cfdi_to_public;
            json['l10n_mx_edi_usage'] = this.l10n_mx_edi_usage;
        }
        return json;
    }
});
