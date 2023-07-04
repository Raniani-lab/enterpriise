/** @odoo-module */

import { usePos } from "@point_of_sale/app/store/pos_hook";
import { OrderSummary } from "@point_of_sale/app/screens/product_screen/order_summary/order_summary";
import { patch } from "@web/core/utils/patch";

patch(OrderSummary.prototype, "pos_settle_due.OrderSummary", {
    setup() {
        this.pos = usePos();
    },
    get partnerInfos() {
        const order = this.props.order;
        return this.pos.getPartnerCredit(order.get_partner());
    },
});
