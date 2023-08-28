/** @odoo-module **/
import { Component, useState, onWillUnmount, useRef } from "@odoo/owl";
import { usePreparationDisplay } from "@pos_preparation_display/app/preparation_display_service";
import { Orderline } from "@pos_preparation_display/app/components/orderline/orderline";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { computeFontColor } from "@pos_preparation_display/app/utils";

export class Order extends Component {
    static props = {
        order: Object,
    };

    setup() {
        this.preparationDisplay = usePreparationDisplay();
        this.orderlinesContainer = useRef("orderlines-container");
        this.state = useState({
            duration: 0,
            productHighlighted: [],
        });

        this.state.duration = this._computeDuration();
        this.interval = setInterval(() => {
            this.state.duration = this._computeDuration();
        }, 1000);

        onWillUnmount(() => {
            clearInterval(this.interval);
        });
    }
    get stage() {
        const order = this.props.order;
        return this.preparationDisplay.stages.get(order.stageId);
    }

    get fondColor() {
        return computeFontColor(this.stage.color);
    }

    _computeDuration() {
        const timeDiff = (
            (luxon.DateTime.now().ts - deserializeDateTime(this.props.order.lastStageChange).ts) /
            1000
        ).toFixed(0);

        if (timeDiff > this.stage.alertTimer * 60) {
            this.isAlert = true;
        } else {
            this.isAlert = false;
        }

        return Math.round(timeDiff / 60);
    }

    async doneOrder() {
        if (this.props.order.stageId !== this.preparationDisplay.lastStage.id) {
            return;
        }

        this.props.order.displayed = false;
        this.preparationDisplay.doneOrders([this.props.order]);
    }

    get cardColor() {
        return "o_pdis_card_color_0";
    }
}

Order.components = { Orderline };
Order.template = "pos_preparation_display.Order";
