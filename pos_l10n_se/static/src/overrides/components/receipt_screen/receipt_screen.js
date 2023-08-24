/** @odoo-module */

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";
import { deserializeDateTime } from "@web/core/l10n/dates";

patch(ReceiptScreen.prototype, {
    get receiptData() {
        const receiptData = super.receiptData;

        if (this.pos.useBlackBoxSweden()) {
            const receipt_render_env = super.receiptEnv;
            receiptData.receipt.useBlackBoxSweden = true;
            receiptData.receipt.company.street = this.pos.company.street;
            receiptData.receipt.posID = this.pos.config.id;

            receiptData.receipt.orderSequence = receiptData.order.sequence_number;
            receiptData.receipt.unitID = receiptData.order.blackbox_unit_id;
            receiptData.receipt.blackboxSignature = receiptData.order.blackbox_signature;

            receipt_render_env.receipt.originalOrderDate = deserializeDateTime(
                receipt_render_env.order.creation_date
            ).toFormat("HH:mm dd/MM/yyyy");

            receiptData.productLines = receiptData.receipt.orderlines.filter((orderline) => {
                return orderline.product_type !== "service";
            });

            receiptData.serviceLines = receiptData.receipt.orderlines.filter((orderline) => {
                return orderline.product_type === "service";
            });
        }
        return receiptData;
    },
});
