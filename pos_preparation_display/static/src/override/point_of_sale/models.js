/** @odoo-module **/
import { Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(Order.prototype, {
    // This function send order change to preparation display.
    // For sending changes to printer see printChanges function.
    async sendChanges(cancelled) {
        // In the point_of_sale, we try to find the server_id in order to keep the
        // orders traceable in the preparation tools.
        // For the pos_restaurant, this is mandatory, without the server_id,
        // we cannot find the order table.

        if (!this.server_id || this.pos.ordersToUpdateSet.has(this)) {
            this.pos.ordersToUpdateSet.add(this);
            await this.pos.sendDraftToServer();
        }

        const orderChange = this.changesToOrder(cancelled);
        const preparationDisplayOrderLineIds = Object.entries(orderChange).flatMap(
            ([type, changes]) =>
                changes
                    .filter((change) => {
                        const product = this.pos.db.get_product_by_id(change.product_id);
                        return product.pos_categ_ids.length;
                    })
                    .map((change) => {
                        const product = this.pos.db.get_product_by_id(change.product_id);
                        let quantity = change.quantity;
                        if (type === "cancelled" && change.quantity > 0) {
                            quantity = -change.quantity;
                        }
                        return {
                            todo: true,
                            internal_note: change.note,
                            attribute_value_ids: change.attribute_value_ids,
                            product_id: change.product_id,
                            product_quantity: quantity,
                            product_category_ids: product.pos_categ_ids,
                        };
                    })
        );

        if (!preparationDisplayOrderLineIds.length) {
            return true;
        }

        try {
            const posPreparationDisplayOrder = this.preparePreparationOrder(
                this,
                preparationDisplayOrderLineIds
            );

            await this.env.services.orm.call("pos_preparation_display.order", "process_order", [
                posPreparationDisplayOrder,
            ]);
        } catch (e) {
            console.warn(e);
            return false;
        }

        return true;
    },
    // Overrided in pos_restaurant_preparation_display
    preparePreparationOrder(order, orderline) {
        return {
            preparation_display_order_line_ids: orderline,
            displayed: true,
            pos_order_id: order.server_id || false,
        };
    },
    setCustomerCount(count) {
        super.setCustomerCount(count);
        this.pos.ordersToUpdateSet.add(this);
    },
});
