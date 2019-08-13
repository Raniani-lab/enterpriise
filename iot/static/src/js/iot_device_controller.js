odoo.define('iot.IoTDeviceFormController', function (require) {
"use strict";

var core = require('web.core');
var FormController = require('web.FormController');
var DeviceProxy = require('iot.widgets').DeviceProxy;

var _t = core._t;

var IotDeviceFormController = FormController.extend({
    /**
     * @override
     */
    saveRecord: function () {
        var self = this;
        var _super = this._super.bind(this);
        if (['keyboard', 'scanner'].indexOf(this.renderer.state.data.type) >= 0) {
            return this._updateKeyboardLayout()
                .then(function (data) {
                    if (data.result === true) {
                        _super.apply(arguments);
                    } else {
                        self.do_warn(_t('Connection to Device failed'), _t('Please check if the device is still connected.'));
                    }
                });
        } else {
            return this._super.apply(this, arguments);
        }
    },
    /**
     * Send an action to the device to update the keyboard layout
     */
    _updateKeyboardLayout: function () {
        var keyboard_layout = this.renderer.state.data.keyboard_layout;
        var iot_device = new DeviceProxy({ iot_ip: this.renderer.state.data.iot_ip, identifier: this.renderer.state.data.identifier });
        if (keyboard_layout) {
            return this._rpc({
                model: 'iot.keyboard.layout',
                method: 'read',
                args: [[keyboard_layout.res_id], ['layout', 'variant']],
            }).then(function (res) {
                return iot_device.action({'action': 'update_layout', 'layout': res[0].layout, 'variant': res[0].variant});
            });
        } else {
            return iot_device.action({'action': 'update_layout'});
        }
    },
});

return IotDeviceFormController;

});
