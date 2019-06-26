odoo.define('pos_iot.models', function (require) {
    "use strict";

var models = require('point_of_sale.models');
var DeviceProxy = require('iot.widgets').DeviceProxy;
var PrinterProxy = require('pos_iot.Printer');

models.load_fields("res.users", "lang");

models.load_models([{
    model: 'iot.device',
    fields: ['iot_ip', 'identifier', 'type'],
    domain: function(self) { return [['iot_id', '=', self.config.iotbox_id[0]], ]; },
    loaded: function(self, iot_devices) {
        var used_devices = {
            'payment': self.config.iface_payment_terminal,
            'scale': self.config.iface_electronic_scale,
        };
        var iot_device_proxies = {};
        _.each(iot_devices, function(iot_device) {
            // We assume that there is only one device of each type connected to the iot box.
            // If there are more the, last device on the list will be used.
            if(used_devices[iot_device.type]) {
                iot_device_proxies[iot_device.type] = new DeviceProxy({ iot_ip: iot_device.iot_ip, identifier: iot_device.identifier });
            } else if (self.config.iface_print_via_proxy && iot_device.id === self.config.iface_printer_id[0]) {
                iot_device_proxies[iot_device.type] = new PrinterProxy({ iot_ip: iot_device.iot_ip, identifier: iot_device.identifier });
            }
        });
        self.iot_device_proxies = iot_device_proxies;
        if (_.size(self.iot_device_proxies)) {
            self.config.use_proxy = true;
        }
    },
}]);
});
