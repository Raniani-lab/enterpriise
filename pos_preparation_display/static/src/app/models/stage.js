/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";

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
