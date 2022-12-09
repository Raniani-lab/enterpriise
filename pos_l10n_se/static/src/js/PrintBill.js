/** @odoo-module */
import PrintBillButton from "@pos_restaurant/js/Screens/ProductScreen/ControlButtons/PrintBillButton";
import Registries from "@point_of_sale/js/Registries";

const PosSwedenPrintBillButton = (PrintBillButton) =>
    class extends PrintBillButton {
        async onClick() {
            const order = this.env.pos.get_order();
            if (this.env.pos.useBlackBoxSweden()) {
                order.isProfo = true;
                order.receipt_type = "profo";
                const sequence = await this.env.pos.get_profo_order_sequence_number();
                order.sequence_number = sequence;

                await this.env.pos.push_single_order(order);
                order.receipt_type = false;
            }
            await super.onClick();
            order.isProfo = false;
        }
    };

Registries.Component.extend(PrintBillButton, PosSwedenPrintBillButton);

export default PosSwedenPrintBillButton;
