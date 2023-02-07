/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/pos_store";

patch(PosStore.prototype, "pos_settle_due.PosStore", {
    getPartnerCredit(partner) {
        const order = this.globalState.get_order();
        const partnerInfos = {
            totalDue: 0,
            totalWithCart: order ? order.get_total_with_tax() : 0,
            creditLimit: 0,
            useLimit: false,
            overDue: false,
        };

        if (!partner) {
            return partnerInfos;
        }

        if (partner.parent_name) {
            const parent = this.globalState.partners.find((p) => p.name === partner.parent_name);

            if (parent) {
                partner = parent;
            }
        }

        partnerInfos.totalDue = partner.total_due;
        partnerInfos.totalWithCart += partner.total_due;
        partnerInfos.creditLimit = partner.credit_limit;
        partnerInfos.overDue = partnerInfos.totalWithCart > partnerInfos.creditLimit ? true : false;
        partnerInfos.useLimit =
            partner.total_due || partner.use_partner_credit_limit ? true : false;

        return partnerInfos;
    },
});
