/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";

patch(PosStore.prototype, "pos_settle_due.PosStore", {
    getPartnerCredit(partner) {
        const order = this.get_order();
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
            const parent = this.partners.find((p) => p.name === partner.parent_name);

            if (parent) {
                partner = parent;
            }
        }

        partnerInfos.totalDue = partner.total_due;
        partnerInfos.totalWithCart += partner.total_due;
        partnerInfos.creditLimit = partner.credit_limit;
        partnerInfos.overDue = partnerInfos.totalWithCart > partnerInfos.creditLimit ? true : false;
        partnerInfos.useLimit =
            this.company.account_use_credit_limit &&
            partner.credit_limit > 0 &&
            partnerInfos.overDue
                ? true
                : false;

        return partnerInfos;
    },
});
