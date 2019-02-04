odoo.define('quality_iot.iot_picture', function (require) {
"use strict";

var registry = require('web.field_registry');
var TabletImage = require('quality.tablet_image_field').TabletImage;
var IoTCoreMixin = require('iot.widgets').IoTCoreMixin;

var TabletImageIot = TabletImage.extend(IoTCoreMixin, {
    events: _.extend({}, TabletImage.prototype.events, {
        'click .o_input_file': function (ev) {
            ev.stopImmediatePropagation();
            if (this._url()) {
                ev.preventDefault();
                this._onButtonClick();
            }
        },
    }),

    init: function () {
        this._super.apply(this, arguments);
        var identifierField = this.nodeOptions.identifier;
        this.identifier = this.record.data[identifierField];
    },

    _onButtonClick: function () {
        var url = this._url() + "/hw_drivers/driveraction/camera";
        var data = {'action': 'camera', 'identifier': this.identifier};
        var self = this;

        return this._callIotDevice(url, data, this._url()).done(function (response){
            if (response.result && response.result.image){
                self._setValue(response['result']['image']);
                self._render();
            } else {
                self._doWarnError();
            }
        });
    },
});

registry.add('iot_picture', TabletImageIot);

return TabletImageIot;
});
