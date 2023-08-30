/** @odoo-module */

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";

patch(ReceiptScreen.prototype, {
    getTaxLetter(taxes) {
        if (this.pos.useBlackBoxSweden()) {
            return taxes.sweden_identification_letter;
        }
        return super.getTaxLetter(taxes);
    }
});
