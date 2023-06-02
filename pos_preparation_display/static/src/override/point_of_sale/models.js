/** @odoo-module **/
import { PosGlobalState, Order } from "@point_of_sale/app/store/models";
import { patch } from "@web/core/utils/patch";

patch(PosGlobalState.prototype, "pos_preparation_display.PosGlobalState", {
    setup() {
        this._super(...arguments);

        this.preparationDisplays = [];
    },

    _initializePreparationDisplay() {
        const preparationDisplayCategories = this.preparationDisplays.flatMap(
            (preparationDisplay) => preparationDisplay.pdis_category_ids
        );
        this.preparationDisplayCategoryIds = new Set(preparationDisplayCategories);
    },

    // @override - add preparation display categories to global order preparation categories
    get orderPreparationCategories() {
        let categoryIds = this._super();
        if (this.preparationDisplayCategoryIds) {
            categoryIds = new Set([...categoryIds, ...this.preparationDisplayCategoryIds]);
        }
        return categoryIds;
    },

    // @override
    async _processData(loadedData) {
        await this._super(loadedData);
        this.preparationDisplays = loadedData["pos_preparation_display.display"];
    },

    // @override
    async after_load_server_data() {
        await this._super(...arguments);
        this._initializePreparationDisplay();
    },
});

patch(Order.prototype, "pos_preparation_display.Order", {
    // This function send order change to preparation display.
    // For sending changes to printer see printChanges function.
    async sendChanges(cancelled) {
        // In the point_of_sale, we try to find the server_id in order to keep the
        // orders traceable in the preparation tools.
        // For the pos_restaurant, this is mandatory, without the server_id,
        // we cannot find the order table.
        if (!this.server_id) {
            await this.pos.sendDraftToServer();
        }

        const orderChange = this.changesToOrder(cancelled);
        const preparationDisplayOrderLineIds = Object.entries(orderChange).flatMap(
            ([type, changes]) =>
                changes
                    .filter((change) => {
                        const product = this.pos.db.get_product_by_id(change.product_id);
                        return product.pos_categ_id[0];
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
                            product_id: change.product_id,
                            product_quantity: quantity,
                            product_category_id: product.pos_categ_id[0],
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

            await this.pos.env.services.orm.call("pos_preparation_display.order", "process_order", [
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
});
