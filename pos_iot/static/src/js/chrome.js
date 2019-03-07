odoo.define('pos_iot.chrome', function (require) {
"use strict";

var ProxyStatusWidget = require('point_of_sale.chrome').ProxyStatusWidget;

ProxyStatusWidget.include({
    is_printer_connected: function (printer) {
        return printer && printer.status === 'connected' && printer.printers.indexOf(this.pos.iot_device_proxies.printer._identifier) >= 0;
    },
});
});
