/** @odoo-module **/
import { Category } from "@pos_preparation_display/app/components/category/category";
import { Stages } from "@pos_preparation_display/app/components/stages/stages";
import { Order } from "@pos_preparation_display/app/components/order/order";
import { usePreparationDisplay } from "@pos_preparation_display/app/preparation_display_service";
import { Component, onPatched } from "@odoo/owl";

export class PreparationDisplay extends Component {
    static props = {};

    setup() {
        this.preparationDisplay = usePreparationDisplay();
        this.displayName = odoo.preparation_display.name;
        this.onNextPatch = new Set();

        onPatched(() => {
            for (const cb of this.onNextPatch) {
                cb();
            }
        });
    }
    get filterSelected() {
        return (
            this.preparationDisplay.selectedCategories.size +
            this.preparationDisplay.selectedProducts.size
        );
    }
    archiveAllVisibleOrders() {
        const lastStageVisibleOrderIds = this.preparationDisplay.filteredOrders.filter(
            (order) => order.stageId === this.preparationDisplay.lastStage.id
        );

        for (const order of lastStageVisibleOrderIds) {
            order.displayed = false;
        }

        this.preparationDisplay.doneOrders(lastStageVisibleOrderIds);
        this.preparationDisplay.filterOrders();
    }
    resetFilter() {
        this.preparationDisplay.selectedCategories = new Set();
        this.preparationDisplay.selectedProducts = new Set();
        this.preparationDisplay.filterOrders();
        this.preparationDisplay.saveFilterToLocalStorage();
    }
    toggleCategoryFilter() {
        this.preparationDisplay.showCategoryFilter = !this.preparationDisplay.showCategoryFilter;
    }
    getFilters() {
        const productFilters = Object.values(this.preparationDisplay.products).filter((product) =>
            this.preparationDisplay.selectedProducts.has(product.id)
        );
        const categoryFilters = Object.values(this.preparationDisplay.categories).filter(
            (category) => this.preparationDisplay.selectedCategories.has(category.id)
        );

        return { categoryFilters, productFilters };
    }
    createNewProducts() {
        window.open("/web#action=point_of_sale.action_client_product_menu", "_self");
    }
}

PreparationDisplay.components = { Category, Stages, Order };
PreparationDisplay.template = `pos_preparation_display.PreparationDisplay`;
