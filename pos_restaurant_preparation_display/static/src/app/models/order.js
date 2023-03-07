/** @odoo-module **/
import { patch } from "@web/core/utils/patch";
import { Order } from "@pos_preparation_display/app/models/order";

patch(Order.prototype, "pos_restaurant_preparation_display.OrderModel", {
    setup(order) {
        this._super(...arguments);
        this.table = order.table;
    },
});
