/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";
import { AlertPopup } from "@point_of_sale/app/utils/alert_popup/alert_popup";
import { _t } from "@web/core/l10n/translation";

patch(PosStore.prototype, "pos_preparation_display.PosStore", {
    async setup() {
        await this._super(...arguments);
        this.preparationDisplays = [];
    },

    _initializePreparationDisplay() {
        const preparationDisplayCategories = this.preparationDisplays.flatMap(
            (preparationDisplay) => preparationDisplay.pdis_category_ids
        );
        this.preparationDisplayCategoryIds = new Set(preparationDisplayCategories);
    },

    // @override - add preparation display categories to global order preparation categories
    get orderPreparationCategories() {
        let categoryIds = this._super();
        if (this.preparationDisplayCategoryIds) {
            categoryIds = new Set([...categoryIds, ...this.preparationDisplayCategoryIds]);
        }
        return categoryIds;
    },

    // @override
    async _processData(loadedData) {
        await this._super(loadedData);
        this.preparationDisplays = loadedData["pos_preparation_display.display"];
    },

    // @override
    async after_load_server_data() {
        await this._super(...arguments);
        this._initializePreparationDisplay();
    },

    // @override
    async updateModelsData(models_data) {
        await this._super(...arguments);
        if ("pos_preparation_display.display" in models_data) {
            this.preparationDisplays = models_data["pos_preparation_display.display"];
            this._initializePreparationDisplay();
        }
    },

    async sendOrderInPreparation(order, cancelled = false) {
        const _super = this._super;
        let result = true;

        if (this.preparationDisplayCategoryIds.size) {
            result = await order.sendChanges(cancelled);
        }

        // We display this error popup only if the PoS is connected,
        // otherwise the user has already received a popup telling him
        // that this functionality will be limited.
        if (!result && this.synch.status === "connected") {
            await this.popup.add(AlertPopup, {
                title: _t("Send failed"),
                body: _t("Failed in sending the changes to preparation display"),
            });
        }

        return _super(order, cancelled);
    },
});
