/** @odoo-module **/
import { patch } from "@web/core/utils/patch";
import { PreparationDisplay } from "@pos_preparation_display/app/models/preparation_display";

patch(PreparationDisplay.prototype, "pos_restaurant_preparation_display.PreparationDisplay", {
    setup() {
        this.tables = {};
        this._super(...arguments);
    },
    filterOrders() {
        this.tables = {};
        this._super(...arguments);

        for (const order of this.filteredOrders) {
            if (!this.tables[order.table.id]) {
                this.tables[order.table.id] = [];
            }
            this.tables[order.table.id].push(order);
        }
    },
});
