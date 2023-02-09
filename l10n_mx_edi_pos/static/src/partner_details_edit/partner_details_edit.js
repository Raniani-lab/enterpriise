/** @odoo-module */

import { PartnerDetailsEdit } from "@point_of_sale/js/Screens/PartnerListScreen/PartnerDetailsEdit";
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
        if (this.env.pos.company.country.code === 'MX' && event.target.name === 'country_id') {
            this.state.display_mx_fields = this.env.pos.l10n_mx_country_id.toString() === event.target.value;
        }
        this._super(event);
    },
    captureChangeNoTaxBreakdown(event) {
        event.target.toggleAttribute('checked');
        this.changes[event.target.name] = event.target.checked;
    }
});
