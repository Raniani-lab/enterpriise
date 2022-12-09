/** @odoo-module */

import { PosGlobalState } from "@point_of_sale/js/models";
import PrinterProxy from "@pos_iot/js/printers";
import Registries from "@point_of_sale/js/Registries";

// The override of create_printer needs to happen after its declaration in
// pos_restaurant. We need to make sure that this code is executed after the
// models file in pos_restaurant.
import "@pos_restaurant/js/models";

const PosResIotPosGlobalState = (PosGlobalState) =>
    class PosResIotPosGlobalState extends PosGlobalState {
        create_printer(config) {
            if (config.device_identifier && config.printer_type === "iot") {
                return new PrinterProxy(
                    this,
                    { iot_ip: config.proxy_ip, identifier: config.device_identifier },
                    this
                );
            } else {
                return super.create_printer(...arguments);
            }
        }
    };
Registries.Model.extend(PosGlobalState, PosResIotPosGlobalState);
