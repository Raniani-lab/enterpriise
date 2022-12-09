/** @odoo-module */

import AbstractAwaitablePopup from "@point_of_sale/js/Popups/AbstractAwaitablePopup";
import Registries from "@point_of_sale/js/Registries";

class IoTErrorPopup extends AbstractAwaitablePopup {
    setup() {
        super.setup();
        owl.onMounted(this.onMounted);
    }
    onMounted() {
        this.playSound("error");
    }
}
IoTErrorPopup.template = "IoTErrorPopup";
IoTErrorPopup.defaultProps = {
    confirmText: "Ok",
    title: "Error",
    cancelKey: false,
};

Registries.Component.add(IoTErrorPopup);

export default IoTErrorPopup;
