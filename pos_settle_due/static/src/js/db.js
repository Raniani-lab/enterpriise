/** @odoo-module */

import PosDB from "@point_of_sale/js/db";
PosDB.include({
    update_partners: function (partnersWithUpdatedFields) {
        for (const updatedFields of partnersWithUpdatedFields) {
            Object.assign(this.partner_by_id[updatedFields.id], updatedFields);
        }
    },
});
