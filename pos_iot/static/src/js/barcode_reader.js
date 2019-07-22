odoo.define('pos_iot.BarcodeReader', function (require) {
"use strict";

var BarcodeReader = require('point_of_sale.BarcodeReader');

BarcodeReader.include({
    connect_to_proxy: function () {
        var self = this;
        this.scanner = this.pos.iot_device_proxies.scanner;
        if (this.scanner) {
            this.scanner.add_listener(function (barcode) {
                self.scan(barcode.value);
            });
        }
    },

    // the barcode scanner will stop listening on the hw_proxy/scanner remote interface
    disconnect_from_proxy: function () {
        if (this.scanner) {
            self.scanner.remove_listener();
        }
    },
});

});
