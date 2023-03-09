/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { BarcodeReader } from "@point_of_sale/app/barcode_reader_service";

patch(BarcodeReader.prototype, "pos_iot.BarcodeReader", {
    connectToProxy() {
        this.scanners = this.hardwareProxy.deviceProxies.scanners;
        for (const scanner of Object.values(this.scanners)) {
            scanner.add_listener((barcode) => this.scan(barcode.value));
        }
    },

    // the barcode scanner will stop listening on the hw_proxy/scanner remote interface
    disconnectFromProxy() {
        if (this.scanners) {
            for (const scanner of Object.values(this.scanners)) {
                scanner.remove_listener();
            }
        }
    },
});
