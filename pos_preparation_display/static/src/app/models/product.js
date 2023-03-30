/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";

export class Product extends Reactive {
    constructor([id, productCategoryId, productName]) {
        super();

        this.id = id;
        this.categoryId = productCategoryId;
        this.name = productName;
    }
}
