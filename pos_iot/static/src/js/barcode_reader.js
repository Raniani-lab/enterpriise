/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { BarcodeReader } from "@point_of_sale/app/barcode_reader_service";

patch(BarcodeReader.prototype, "pos_iot.BarcodeReader", {
    connectToProxy(hardwareProxy) {
        this.scanners = hardwareProxy.iot_device_proxies.scanners;
        for (const identifier in this.scanners) {
            this.scanners[identifier].add_listener((barcode) => {
                this.scan(barcode.value);
            });
        }
    },

    // the barcode scanner will stop listening on the hw_proxy/scanner remote interface
    disconnectFromProxy() {
        if (this.scanners) {
            for (const identifier in this.scanners) {
                this.scanners[identifier].remove_listener();
            }
        }
    },
});
