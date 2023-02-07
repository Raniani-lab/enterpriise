/** @odoo-module */

import { ActionpadWidget } from "@point_of_sale/js/Screens/ProductScreen/ActionpadWidget";
import { patch } from "@web/core/utils/patch";

patch(ActionpadWidget.prototype, "pos_settle_due.ActionpadWidget", {
    get partnerInfos() {
        return this.pos.getPartnerCredit(this.props.partner);
    },
});
