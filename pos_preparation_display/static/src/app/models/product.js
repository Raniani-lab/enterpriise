/** @odoo-module **/
import { Reactive } from "@web/core/utils/reactive";

export class Product extends Reactive {
    constructor([id, productCategoryId, productName]) {
        super();

        this.id = id;
        this.categoryId = productCategoryId;
        this.name = productName;
    }
}
