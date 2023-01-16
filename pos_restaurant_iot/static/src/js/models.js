/** @odoo-module */

import { PosGlobalState } from "@point_of_sale/js/models";
import { PrinterProxy } from "@pos_iot/js/printers";
import { patch } from "@web/core/utils/patch";

// The override of create_printer needs to happen after its declaration in
// pos_restaurant. We need to make sure that this code is executed after the
// models file in pos_restaurant.
import "@pos_restaurant/js/models";

patch(PosGlobalState.prototype, "pos_restaurant_iot.PosGlobalState", {
    create_printer(config) {
        if (config.device_identifier && config.printer_type === "iot") {
            return new PrinterProxy(
                this,
                { iot_ip: config.proxy_ip, identifier: config.device_identifier },
                this
            );
        } else {
            return this._super(...arguments);
        }
    },
});
