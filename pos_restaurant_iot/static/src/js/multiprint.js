odoo.define('pos_restaurant_iot.multiprint', function (require) {
"use strict";

var models = require('point_of_sale.models');
var PrinterProxy = require('pos_iot.Printer');

models.load_fields("restaurant.printer", 'device_identifier');

models.PosModel = models.PosModel.extend({
    create_printer: function (config) {
        return new PrinterProxy({ iot_ip: config.proxy_ip, identifier: config.device_identifier }, this);
    },
});
});
