/** @odoo-module */

import { AbstractAwaitablePopup } from "@point_of_sale/js/Popups/AbstractAwaitablePopup";
import { useService } from "@web/core/utils/hooks";

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
        this.sound = useService("sound");
    }
    onMounted() {
        this.sound.play("error");
    }
}
