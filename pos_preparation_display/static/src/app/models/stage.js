/** @odoo-module **/
import { Reactive } from "@web/core/utils/reactive";

export class Stage extends Reactive {
    constructor({ id, name, color, alert_timer, sequence }, preparationDisplay) {
        super();

        this.id = id;
        this.name = name;
        this.color = color;
        this.alertTimer = alert_timer;
        this.sequence = sequence;
        this.preparationDisplay = preparationDisplay;
        this.orderCount = 0;
    }
}
