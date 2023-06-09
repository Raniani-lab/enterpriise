/** @odoo-module */

import { PartnerDetailsEdit } from "@point_of_sale/app/screens/partner_list/partner_editor/partner_editor";
import { patch } from "@web/core/utils/patch";
const { useState } = owl;

patch(PartnerDetailsEdit.prototype, "l10n_mx_edi_pos.PartnerDetailsEdit", {
    setup(){
        this._super(...arguments);
        this.state = useState({
            display_mx_fields: this.props.partner.country_code === 'MX',
        });
    },
    //@override
    captureChange(event) {
        const { company, l10n_mx_country_id } = this.pos;
        if (company.country.code === 'MX' && event.target.name === 'country_id') {
            this.state.display_mx_fields = l10n_mx_country_id.toString() === event.target.value;
        }
        this._super(event);
    },
    captureChangeNoTaxBreakdown(event) {
        event.target.toggleAttribute('checked');
        this.changes[event.target.name] = event.target.checked;
    }
});
