odoo.define('pos_iot.devices', function (require) {
"use strict";

var ProxyDevice = require('point_of_sale.devices').ProxyDevice;

ProxyDevice.include({
    /**
     * @override
     */
    connect_to_printer: function () {
        this.pos.iot_device_proxies.printer.pos = this.pos;
        this.printer = this.pos.iot_device_proxies.printer;
    },
});

});