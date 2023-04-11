/** @odoo-module **/
import { PosGlobalState, Order } from "@point_of_sale/js/models";
import { patch } from "@web/core/utils/patch";
import "@pos_restaurant/js/models";

patch(PosGlobalState.prototype, "pos_preparation_display.PosGlobalState", {
    setup() {
        this._super(...arguments);

        this.preparationDisplays = [];
    },

    _initializePreparationDisplay() {
        const preparationDisplayCategories = this.preparationDisplays.flatMap(
            (preparationDisplay) => preparationDisplay.pdis_category_ids
        );

        if (!this.printers_category_ids_set) {
            this.printers_category_ids_set = new Set();
        }
        this.preparationDisplayCategoryIds = new Set(preparationDisplayCategories);
        this.printers_category_ids_set = new Set([
            ...this.printers_category_ids_set,
            ...preparationDisplayCategories,
        ]);
    },

    // @override
    isInterfacePrinter() {
        if (!this.config.module_pos_restaurant) {
            return false;
        }
        return true;
    },

    // @override
    addSubmitOrderButton() {
        return this.config.module_pos_restaurant;
    },

    // @override
    async _processData(loadedData) {
        await this._super(loadedData);

        if (this.config.module_pos_restaurant) {
            this.preparationDisplays = loadedData["pos_preparation_display.display"];
        }
    },

    // @override
    async after_load_server_data() {
        await this._super(...arguments);

        if (this.config.module_pos_restaurant) {
            this._initializePreparationDisplay();
        }
    },

    async sendPreparationDisplayOrder() {
        await this._pushOrdersToServer();

        const currentOrder = this.get_order();
        const orderChange = currentOrder.printingChanges;

        const preparationDisplayOrderLineIds = Object.entries(orderChange).flatMap(
            ([type, changes]) =>
                changes
                    .filter((change) => {
                        const product = this.db.get_product_by_id(change.product_id);
                        return product.pos_categ_id[0];
                    })
                    .map((change) => {
                        const product = this.db.get_product_by_id(change.product_id);

                        if (type === "cancelled") {
                            change.quantity = -change.quantity;
                        }

                        return {
                            todo: true,
                            internal_note: change.note,
                            product_id: change.product_id,
                            product_quantity: change.quantity,
                            product_category_id: product.pos_categ_id[0],
                        };
                    })
        );

        if (!preparationDisplayOrderLineIds.length) {
            return false;
        }

        const posPreparationDisplayOrder = {
            preparation_display_order_line_ids: preparationDisplayOrderLineIds,
            displayed: true,
            pos_order_id: currentOrder.server_id || false,
        };

        await this.env.services.orm.call("pos_preparation_display.order", "process_order", [
            posPreparationDisplayOrder,
        ]);

        return true;
    },
});

patch(Order.prototype, "pos_preparation_display.Order", {
    // @override
    hasChangesToPrint() {
        const categories = this.pos.preparationDisplays.flatMap(
            (display) => display.pdis_category_ids
        );

        const changes = this._getPrintingCategoriesChanges(categories);

        if (changes.new.length > 0 || changes.cancelled.length > 0) {
            return true;
        } else {
            return this._super(...arguments);
        }
    },
    async submitOrder() {
        const _super = this._super;
        await this.pos.sendPreparationDisplayOrder();
        _super(...arguments);
    },
});
