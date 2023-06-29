/** @odoo-module */

import { PartnerDetailsEdit } from "@point_of_sale/app/screens/partner_list/partner_editor/partner_editor";
import { patch } from "@web/core/utils/patch";

patch(PartnerDetailsEdit.prototype, "l10n_cl_edi_pos.PartnerDetailsEdit", {
    setup() {
        this._super(...arguments);
        this.intFields.push("l10n_latam_identification_type_id");
        this.changes.l10n_cl_sii_taxpayer_type = "1";
    },
});
