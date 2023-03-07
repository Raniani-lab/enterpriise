/** @odoo-module */
import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_preparation_display/app/components/order/order";

//this will be use by a modulo 9 so max 9 values.
const colorHeader = [
    "#8560D4",
    "#BB4947",
    "#DB8735",
    "#87C647",
    "#3DAB6C",
    "#3CB5A9",
    "#3C85C1",
    "#5061C7",
    "#D0517C",
];

patch(Order.prototype, "pos_restaurant_preparation_display.Order", {
    get headerColor() {
        const table = this.props.order.table;
        let tableOrdersInStage = [];

        if (table?.id && this.preparationDisplay.tables[table.id].length) {
            const tableOrders = this.preparationDisplay.tables[table.id];
            tableOrdersInStage = tableOrders.filter((order) => order.stageId === this.stage.id);

            if (this.preparationDisplay.selectedStageId === 0) {
                tableOrdersInStage = tableOrders;
            }
        }

        if (tableOrdersInStage.length > 1) {
            return colorHeader[table.id % 9];
        } else {
            return this._super();
        }
    },
});
