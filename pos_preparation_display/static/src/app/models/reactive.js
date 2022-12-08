/** @odoo-module **/
import { reactive } from "@odoo/owl";

export class Reactive {
    constructor() {
        return reactive(this);
    }
}
