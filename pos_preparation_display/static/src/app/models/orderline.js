/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";

export class Orderline extends Reactive {
    constructor(
        {
            id,
            internal_note = "",
            product_cancelled,
            product_category_id,
            product_id,
            product_name,
            product_quantity,
            todo,
        },
        order
    ) {
        super();

        this.id = id;
        this.internalNote = internal_note;
        this.productCancelled = product_cancelled;
        this.productCategoryId = product_category_id;
        this.productId = product_id;
        this.productName = product_name;
        this.productQuantity = product_quantity;
        this.todo = todo;
        this.order = order;
    }

    get productCount() {
        const productCount = this.productQuantity - this.productCancelled;
        return productCount;
    }
}
