/** @odoo-module */

import { OrderReceipt } from "@point_of_sale/app/screens/receipt_screen/receipt/receipt";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime } from "@web/core/l10n/dates";

patch(OrderReceipt.prototype, {
    get receiptEnv() {
        if (this.pos.useBlackBoxSweden()) {
            const receipt_render_env = super.receiptEnv;
            receipt_render_env.receipt.useBlackBoxSweden = true;
            receipt_render_env.receipt.company.street = this.pos.company.street;
            receipt_render_env.receipt.posID = this.pos.config.id;

            receipt_render_env.receipt.orderSequence = receipt_render_env.order.sequence_number;
            receipt_render_env.receipt.unitID = receipt_render_env.order.blackbox_unit_id;
            receipt_render_env.receipt.blackboxSignature =
                receipt_render_env.order.blackbox_signature;

            receipt_render_env.receipt.originalOrderDate = deserializeDateTime(
                receipt_render_env.order.creation_date
            ).toFormat("HH:mm dd/MM/yyyy");

            return receipt_render_env;
        }
        return super.receiptEnv;
    },
    getProductlines() {
        return this.receiptEnv.receipt.orderlines.filter((orderline) => {
            return orderline.product_type !== "service";
        });
    },
    getServicelines() {
        return this.receiptEnv.receipt.orderlines.filter((orderline) => {
            return orderline.product_type === "service";
        });
    },
});
