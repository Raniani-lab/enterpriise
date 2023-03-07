/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/pos_store";
import { AlertPopup } from "@point_of_sale/js/Popups/AlertPopup";
import { _t } from "@web/core/l10n/translation";

patch(PosStore.prototype, "pos_preparation_display.PosStore", {
    async sendOrderInPreparation(order) {
        const _super = this._super;
        const result = await this.globalState.sendPreparationDisplayOrder(order);

        if (!result) {
            await this.popup.add(AlertPopup, {
                title: _t("Send failed"),
                body: _t("Failed in sending the changes to preparation display"),
            });
        }

        return _super(...arguments);
    },
});
