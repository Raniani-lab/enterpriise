/* @odoo-module */

import { PosPopupController } from "@point_of_sale/js/Popups/PosPopupController";
import { patch } from "@web/core/utils/patch";
import { IoTErrorPopup } from "./IoTErrorPopup";
import { LastTransactionPopup } from "./LastTransactionStatus";

patch(PosPopupController, "pos_iot.PosPopupController", {
    components: {
        ...PosPopupController.components,
        IoTErrorPopup,
        LastTransactionPopup,
    },
});
