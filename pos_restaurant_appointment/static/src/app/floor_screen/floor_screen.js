/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { FloorScreen } from "@pos_restaurant/app/floor_screen/floor_screen";

patch(FloorScreen.prototype, "pos_restaurant_appointment.table", {
    async _createTableHelper(copyTable, duplicateFloor = false) {
        const table = await this._super(...arguments);
        table.appointment_ids = {}; // event.id |-> event
        return table;
    },
});
