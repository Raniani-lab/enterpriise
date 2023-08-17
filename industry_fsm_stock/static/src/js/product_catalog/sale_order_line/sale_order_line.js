/** @odoo-module */
import { ProductCatalogSOL } from "@sale/js/product_catalog/sale_order_line/sale_order_line";
import { patch } from "@web/core/utils/patch";

patch(ProductCatalogSOL, {
    props: {
        ...ProductCatalogSOL.props,
        tracking: Boolean,
        minimumQuantityOnProduct: Number,
    },
});

patch(ProductCatalogSOL.prototype, {
    get disableRemove() {
        if (this.env.fsm_task_id) {
            return this.props.quantity === this.props.minimumQuantityOnProduct;
        }
        return this.props.quantity === this.props.deliveredQty;
    },
});
