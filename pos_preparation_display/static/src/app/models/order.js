/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";

export class Order extends Reactive {
    constructor({
        id,
        stage_id,
        displayed,
        responsible,
        table,
        orderlines,
        create_date,
        last_stage_change,
        pos_order_id,
    }) {
        super();

        this.id = id;
        this.stageId = stage_id;
        this.displayed = displayed;
        this.responsible = responsible;
        this.table = table;
        this.orderlines = orderlines;
        this.createDate = create_date;
        this.lastStageChange = last_stage_change;
        this.posOrderId = pos_order_id;
        this.changeStageTimeout = null;
    }

    resetOrderlineStatus() {
        for (const orderline of this.orderlines) {
            if (orderline.productQuantity - orderline.productCancelled !== 0) {
                orderline.todo = true;
            }
        }
    }

    clearChangeTimeout() {
        clearTimeout(this.changeStageTimeout);
        this.changeStageTimeout = null;
    }
}
