odoo.define('pos_iot.widgets', function (require) {
'use strict';

var core = require('web.core');
var IoTLongpolling = require('iot.widgets').IoTLongpolling;

var _t = core._t;

IoTLongpolling.include({
    _doWarnFail: function (url) {
        window.posmodel.gui.show_popup('iot_error', {
            title: _t('Connection to IoT Box failed'),
            url: url,
        });
    },
});
});
