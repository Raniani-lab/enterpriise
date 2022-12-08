/** @odoo-module **/
import { Component } from "@odoo/owl";
import { usePreparationDisplay } from "@pos_preparation_display/app/preparation_display_service";
import { useService } from "@web/core/utils/hooks";

export class Orderline extends Component {
    static props = {
        orderline: Object,
    };

    setup() {
        this.preparationDisplay = usePreparationDisplay();
        this.orm = useService("orm");
    }

    async changeOrderlineStatus() {
        const orderline = this.props.orderline;
        const newState = !orderline.todo;
        const order = this.props.orderline.order;

        orderline.todo = newState;

        await this.orm.call(
            "pos_preparation_display.orderline",
            "change_line_status",
            [[orderline.id], newState],
            {}
        );

        this.preparationDisplay.changeOrderStage(order);
    }
}

Orderline.template = "pos_preparation_display.Orderline";
