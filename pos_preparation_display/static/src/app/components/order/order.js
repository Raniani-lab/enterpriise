/** @odoo-module **/
import { Component, useState, onWillUnmount, useRef, useEffect } from "@odoo/owl";
import { usePreparationDisplay } from "@pos_preparation_display/app/preparation_display_service";
import { Orderline } from "@pos_preparation_display/app/components/orderline/orderline";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { shallowEqual } from "@web/core/utils/arrays";

export class Order extends Component {
    static props = {
        order: Object,
        onPatched: Function,
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

        useEffect(
            () => this.props.onPatched(() => this.productBubbleHighlight()),
            () => []
        );

        onWillUnmount(() => {
            clearInterval(this.interval);
        });
    }
    get stage() {
        const order = this.props.order;
        return this.preparationDisplay.stages.get(order.stageId);
    }
    get headerColor() {
        return "#E0E2E6";
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

    productBubbleHighlight() {
        const { selectedProducts, selectedCategories } = this.preparationDisplay;
        const { el } = this.orderlinesContainer;
        const orderlinesContainerHeight = el?.offsetHeight + el?.scrollTop + 10;
        const orderlineToHighlight = [];

        let productIdsTohighlight = [];
        let currentHeight = 0;

        if ((!selectedCategories && !selectedProducts) || !el) {
            return false;
        }

        if (selectedCategories) {
            for (const categoryId in this.preparationDisplay.categories) {
                if (selectedCategories.has(categoryId)) {
                    productIdsTohighlight.push(...selectedCategories.productIds);
                }
            }
        }
        productIdsTohighlight = [...selectedProducts];

        for (const orderlineEl of el.children) {
            const orderlineId = parseInt(orderlineEl.attributes.orderlineId?.value);
            const orderline = this.preparationDisplay.orderlines[orderlineId];
            currentHeight += orderlineEl.offsetHeight;

            if (
                currentHeight > orderlinesContainerHeight &&
                productIdsTohighlight.includes(orderline?.productId)
            ) {
                orderlineToHighlight.push(orderline.productName);
            }
        }

        if (!shallowEqual(this.state.productHighlighted, orderlineToHighlight)) {
            this.state.productHighlighted = orderlineToHighlight;
        }
    }
}

Order.components = { Orderline };
Order.template = "pos_preparation_display.Order";