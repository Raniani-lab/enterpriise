/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/js/Popups/AbstractAwaitablePopup";

export class IoTErrorPopup extends AbstractAwaitablePopup {
    static template = "IoTErrorPopup";
    static defaultProps = {
        confirmText: "Ok",
        title: "Error",
        cancelKey: false,
    };

    setup() {
        super.setup();
        owl.onMounted(this.onMounted);
    }
    onMounted() {
        this.playSound("error");
    }
}
