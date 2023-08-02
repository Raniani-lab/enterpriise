/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { FloorScreen } from "@pos_restaurant/app/floor_screen/floor_screen";

patch(FloorScreen.prototype, {
    async _createTableHelper(copyTable, duplicateFloor = false) {
        const table = await super._createTableHelper(...arguments);
        table.appointment_ids = {}; // event.id |-> event
        return table;
    },
});
