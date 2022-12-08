/** @odoo-module **/
import { Reactive } from "@pos_preparation_display/app/models/reactive";
import { Order } from "@pos_preparation_display/app/models/order";
import { Orderline } from "@pos_preparation_display/app/models/orderline";
import { Stage } from "@pos_preparation_display/app/models/stage";
import { Category } from "@pos_preparation_display/app/models/category";
import { deserializeDateTime } from "@web/core/l10n/dates";

// in the furur, maybe just set "filterOrders" as a getter and directly call the function.
export class PreparationDisplay extends Reactive {
    constructor({ categories, orders, stages }, env, preparationDisplayId) {
        super();

        this.id = preparationDisplayId;
        this.env = env;
        this.showCategoryFilter = true;
        this.orm = env.services.orm;
        this.orders = {};
        this.orderlines = {};
        this.categories = {};
        this.stages = new Map(); // We need a Map() and not an object because the order of the elements is important
        this.selectedStageId = 0;
        this.selectedCategories = new Set();
        this.selectedProducts = new Set();
        this.filteredOrders = [];
        this.tables = {};
        this.rawData = {
            categories: categories,
            orders: orders,
            stages: stages,
        };

        this.processStages();
        this.processCategories();
        this.processOrders();
    }
    filterOrders() {
        this.tables = {};
        const stages = this.stages;
        const selectedCategories = this.selectedCategories;
        const selectedProducts = this.selectedProducts;
        const countedOrders = new Set();
        let ordersToDisplay = [];

        this.stages.forEach((stage) => (stage.orderCount = 0));
        ordersToDisplay = Object.values(this.orders)
            .filter((order) => {
                return order.orderlines.find((orderline) => {
                    // the order must be in selected categories or products (if set) and must be flag as displayed.
                    if (
                        selectedProducts.has(orderline.productId) ||
                        selectedCategories.has(orderline.productCategoryId) ||
                        (selectedProducts.size === 0 &&
                            selectedCategories.size === 0 &&
                            order.displayed)
                    ) {
                        if (!countedOrders.has(order.id)) {
                            this.stages.get(order.stageId).orderCount++;
                            countedOrders.add(order.id);
                        }

                        if (!this.tables[order.table.id]) {
                            this.tables[order.table.id] = [];
                        }
                        this.tables[order.table.id].push(order);

                        // second filter, if a stage is selected the order must be in.
                        if (order.stageId !== this.selectedStageId && this.selectedStageId) {
                            return false;
                        }

                        return true;
                    }
                });
            })
            .sort((a, b) => {
                const stageA = stages.get(a.stageId);
                const stageB = stages.get(b.stageId);
                const stageDiff = stageA.sequence - stageB.sequence || stageA.id - stageB.id; // sort by stage

                if (stageDiff) {
                    return stageDiff;
                }

                // within the stage, keep the default order unless the state is done then show most recent first.
                let difference;
                if (stageA.id === this.lastStage.id) {
                    difference =
                        deserializeDateTime(b.lastStageChange).ts -
                        deserializeDateTime(a.lastStageChange).ts;
                } else {
                    difference =
                        deserializeDateTime(a.lastStageChange).ts -
                        deserializeDateTime(b.lastStageChange).ts;
                }

                return difference;
            });

        this.filteredOrders = ordersToDisplay;
    }
    get lastStage() {
        return [...this.stages.values()][this.stages.size - 1];
    }

    get firstStage() {
        return [...this.stages.values()][0];
    }
    selectStage(stageId) {
        this.selectedStageId = stageId;
        this.filterOrders();
    }
    async doneOrders(orders) {
        await this.orm.call(
            "pos_preparation_display.order",
            "done_orders_stage",
            [orders.map((order) => order.id), this.id],
            {}
        );
        this.filterOrders();
    }
    wsMoveToNextStage(orderId, stageId, lastStageChange) {
        const order = this.orders[orderId];
        clearTimeout(order.changeStageTimeout);

        order.stageId = stageId;
        order.lastStageChange = lastStageChange;
        order.resetOrderlineStatus();
        this.filterOrders();
    }
    orderNextStage(order) {
        if (order.stageId === this.lastStage.id) {
            return this.firstStage;
        }

        const stages = [...this.stages.values()];
        const currentStagesIdx = stages.findIndex((stage) => stage.id === order.stageId);

        return stages[currentStagesIdx + 1] ?? false;
    }
    async changeOrderStage(order, force = false) {
        let nextStage;
        const orderlineDone = order.orderlines.every((orderline) => orderline.todo === false);
        const orderlineCancelled = order.orderlines.every(
            (orderline) => orderline.productQuantity - orderline.productCancelled === 0
        );

        if (orderlineCancelled) {
            nextStage = this.lastStage;
        } else {
            nextStage = this.orderNextStage(order);
        }

        if (order.changeStageTimeout) {
            if (orderlineDone) {
                order.resetOrderlineStatus();
            }

            order.clearChangeTimeout();
            return;
        }

        if (!force) {
            if (!nextStage || !orderlineDone) {
                return;
            }
        }

        for (const orderline of order.orderlines) {
            orderline.todo = false;
        }

        order.changeStageTimeout = setTimeout(async () => {
            order.stageId = nextStage.id;
            order.lastStageChange = await this.orm.call(
                "pos_preparation_display.order",
                "change_order_stage",
                [[order.id], order.stageId, this.id],
                {}
            );

            order.resetOrderlineStatus();
            order.clearChangeTimeout();
            this.filterOrders();
        }, 10000);
    }
    async getOrders() {
        this.rawData.orders = await this.orm.call(
            "pos_preparation_display.order",
            "get_preparation_display_order",
            [[], this.id],
            {}
        );

        this.processOrders();
    }
    processCategories() {
        this.categories = Object.fromEntries(
            this.rawData.categories
                .map((category) => [category.id, new Category(category)])
                .sort((a, b) => a.sequence - b.sequence)
        );
    }
    processStages() {
        this.selectStage(this.rawData.stages[0].id);
        this.stages = new Map(
            this.rawData.stages.map((stage) => [stage.id, new Stage(stage, this)])
        );
    }
    //fixme remove cancelled fonctionality
    processOrders() {
        this.stages.forEach((stage) => (stage.orders = []));

        for (const index in this.categories) {
            this.categories[index].orderlines = [];
        }

        this.orders = this.rawData.orders.reduce((orders, order) => {
            if (order.stage_id === null) {
                order.stage_id = this.firstStage.id;
            }

            const orderObj = new Order(order);

            orderObj.orderlines = order.orderlines.reduce((orderlines, value) => {
                const orderline = new Orderline(value, orderObj);

                this.orderlines[orderline.id] = orderline;
                this.categories[orderline.productCategoryId]?.orderlines?.push(orderline);
                this.categories[orderline.productCategoryId]?.productIds?.add(orderline.productId);
                orderlines.push(orderline);

                return orderlines;
            }, []);

            if (orderObj.orderlines.length > 0) {
                orders[order.id] = orderObj;
            }

            return orders;
        }, {});

        this.filterOrders();
        return this.orders;
    }
    wsChangeLineStatus(orderlineId, todo) {
        this.orderlines[orderlineId].todo = todo;
    }
    toggleCategory(categoryId) {
        if (this.selectedCategories.has(categoryId)) {
            this.selectedCategories.delete(categoryId);
        } else {
            this.selectedCategories.add(categoryId);
        }

        this.filterOrders();
    }
    toggleProduct(productId) {
        if (this.selectedProducts.has(productId)) {
            this.selectedProducts.delete(productId);
        } else {
            this.selectedProducts.add(productId);
        }

        this.filterOrders();
    }
    async resetOrders() {
        this.orders = {};
        this.rawData.orders = await this.orm.call(
            "pos_preparation_display.display",
            "reset",
            [[this.id]],
            {}
        );
    }
    exit() {
        window.location.href = "/web#action=pos_preparation_display.action_preparation_display";
    }
}
