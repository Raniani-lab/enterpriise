/** @odoo-module**/
import { patch } from "@web/core/utils/patch";
import { SubmitOrderButton } from "@pos_restaurant/js/Screens/ProductScreen/ControlButtons/SubmitOrderButton";
import { AlertPopup } from "@point_of_sale/js/Popups/AlertPopup";

patch(SubmitOrderButton.prototype, "pos_preparation_display.SubmitOrderButton", {
    /**
     * @override
     */
    async _onClick() {
        if (!this.clicked) {
            this.clicked = true;
            const _super = this._super;
            const result = await this.env.pos.sendPreparationDisplayOrder();

            if (!result) {
                await this.popup.add(AlertPopup, {
                    title: "No preparation changes",
                    body: "There is no order to send to the preparation screen",
                });

                this.clicked = false;
            } else {
                this.clicked = false;

                if (
                    this.env.pos.config.module_pos_restaurant &&
                    this.env.pos.config.is_order_printer
                ) {
                    _super(...arguments);
                } else {
                    this.env.pos.get_order().updatePrintedResume();
                }
            }
        }
    },
});
