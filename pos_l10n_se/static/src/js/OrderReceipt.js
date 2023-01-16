/** @odoo-module */

import { OrderReceipt } from "@point_of_sale/js/Screens/ReceiptScreen/OrderReceipt";
import { patch } from "@web/core/utils/patch";

patch(OrderReceipt.prototype, "pos_l10n_se.OrderReceipt", {
    get receiptEnv() {
        if (this.env.pos.useBlackBoxSweden()) {
            const receipt_render_env = this._super();
            receipt_render_env.receipt.useBlackBoxSweden = true;
            receipt_render_env.receipt.company.street = this.env.pos.company.street;
            receipt_render_env.receipt.posID = this.env.pos.config.id;

            receipt_render_env.receipt.orderSequence = receipt_render_env.order.sequence_number;
            receipt_render_env.receipt.unitID = receipt_render_env.order.blackbox_unit_id;
            receipt_render_env.receipt.blackboxSignature =
                receipt_render_env.order.blackbox_signature;

            receipt_render_env.receipt.originalOrderDate = moment(
                receipt_render_env.order.creation_date
            ).format("HH:mm DD/MM/YYYY");

            return receipt_render_env;
        }
        return this._super();
    },
    getProductlines() {
        return _.filter(this.receiptEnv.receipt.orderlines, function (orderline) {
            return orderline.product_type !== "service";
        });
    },
    getServicelines() {
        return _.filter(this.receiptEnv.receipt.orderlines, function (orderline) {
            return orderline.product_type === "service";
        });
    },
});
