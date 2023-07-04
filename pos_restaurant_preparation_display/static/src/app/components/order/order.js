/** @odoo-module */
import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_preparation_display/app/components/order/order";

patch(Order.prototype, {
    get cardColor() {
        const table = this.props.order.table;
        let tableOrdersInStage = [];

        if (table.id && this.preparationDisplay.tables[table.id].length) {
            const tableOrders = this.preparationDisplay.tables[table.id];
            tableOrdersInStage = tableOrders.filter((order) => order.stageId === this.stage.id);

            if (this.preparationDisplay.selectedStageId === 0) {
                tableOrdersInStage = tableOrders;
            }
        }

        if (tableOrdersInStage.length > 1) {
            const i = table.id % 9;
            return "o_pdis_card_color_" + i;
        } else {
            return "o_pdis_card_color_0";
        }
    },
});
