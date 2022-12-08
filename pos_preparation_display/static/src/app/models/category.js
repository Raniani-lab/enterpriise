/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";

export class Category extends Reactive {
    constructor({ id, display_name, color }) {
        super();

        this.id = id;
        this.name = display_name;
        this.color = color;
        this.orderlines = [];
        this.productIds = new Set();
    }
}
