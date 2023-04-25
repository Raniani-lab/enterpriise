/** @odoo-module */

import { PosGlobalState } from "@point_of_sale/js/models";
import { DeviceController } from "@iot/device_controller";
import { IoTPrinter } from "@pos_iot/js/iot_printer";
import { patch } from "@web/core/utils/patch";

// The override of create_printer needs to happen after its declaration in
// pos_restaurant. We need to make sure that this code is executed after the
// models file in pos_restaurant.
import "@pos_restaurant/js/models";

patch(PosGlobalState.prototype, "pos_restaurant_iot.PosGlobalState", {
    create_printer(config) {
        if (config.device_identifier && config.printer_type === "iot") {
            const device = new DeviceController(this.env.services.iot_longpolling, {
                iot_ip: config.proxy_ip,
                identifier: config.device_identifier,
            });
            return new IoTPrinter({ device });
        } else {
            return this._super(...arguments);
        }
    },
});
