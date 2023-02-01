/** @odoo-module */

import { ReprintReceiptButton } from "@point_of_sale/js/Screens/TicketScreen/ControlButtons/ReprintReceiptButton";
import { patch } from "@web/core/utils/patch";
import { ErrorPopup } from "@point_of_sale/js/Popups/ErrorPopup";
import core from "web.core";
import { useService } from "@web/core/utils/hooks";
var _t = core._t;

patch(ReprintReceiptButton.prototype, "pos_l10n_se.ReprintReceiptButton", {
    setup() {
        this._super(...arguments);
        this.popup = useService("popup");
    },
    async _onClick() {
        const _super = this._super;
        if (this.env.pos.useBlackBoxSweden()) {
            const order = this.props.order;

            if (order) {
                const isReprint = await this.rpc({
                    model: "pos.order",
                    method: "is_already_reprint",
                    args: [[this.env.pos.validated_orders_name_server_id_map[order.name]]],
                });
                if (isReprint) {
                    await this.popup.add(ErrorPopup, {
                        title: _t("POS error"),
                        body: _t("A duplicate has already been printed once."),
                    });
                } else {
                    order.receipt_type = "kopia";
                    await this.env.pos.push_single_order(order);
                    order.receipt_type = false;
                    order.isReprint = true;
                    await this.rpc({
                        model: "pos.order",
                        method: "set_is_reprint",
                        args: [[this.env.pos.validated_orders_name_server_id_map[order.name]]],
                    });
                    return _super(...arguments);
                }
            }
        } else {
            return _super(...arguments);
        }
    },
});
