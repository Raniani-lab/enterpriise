/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";

export class Order extends Reactive {
    constructor({
        id,
        stage_id,
        displayed,
        responsible,
        orderlines,
        create_date,
        last_stage_change,
        pos_order_id,
    }) {
        super();
        this.setup(...arguments);
    }

    setup(order) {
        this.id = order.id;
        this.stageId = order.stage_id;
        this.displayed = order.displayed;
        this.responsible = order.responsible;
        this.orderlines = order.orderlines;
        this.createDate = order.create_date;
        this.lastStageChange = order.last_stage_change;
        this.posOrderId = order.pos_order_id;
        this.changeStageTimeout = null;
    }

    clearChangeTimeout() {
        clearTimeout(this.changeStageTimeout);
        this.changeStageTimeout = null;
    }
}
