odoo.define('delivery.iot', function (require) {
'use strict';

var FieldMany2One = require('web.relational_fields').FieldMany2One;
var iot_widgets = require('iot.widgets');
var field_registry = require('web.field_registry');

var FieldMany2OneIotScale = FieldMany2One.extend(iot_widgets.IotValueFieldMixin, {

    /**
     * @override
     */
    destroy: function () {
        this._stopListening();
        this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    reset: function () {
        this._super.apply(this, arguments);
        if (!this.iot_device || this.iot_device._identifier != this.recordData.iot_device_identifier) {
            this._stopListening();
            this._getDeviceInfo();
            this._startListening();
        }
    },

    start: function() {
        this._super.apply(this, arguments);
        this._startListening();
    },

    /**
     * Create a proxy for the selected device.
     * @private
     * @override
     * @returns {Promise}
     */
    _getDeviceInfo: function () {
        var record_data = this.record.data;
        if (record_data.iot_device_identifier && record_data.iot_ip) {
            this.iot_device = new iot_widgets.DeviceProxy({ identifier: record_data.iot_device_identifier, iot_ip: record_data.iot_ip });
        }
        return Promise.resolve();
    },

    /**
     * @private
     * @override
     * @param {Object} data
     */
    _onValueChange: function (data) {
        var changes = {};
        changes[this.attrs.options.value_field] = data.value;
        this.trigger_up('field_changed', {
            dataPointID: this.record.id,
            changes: changes,
        });
    },

    /**
     * @private
     */
    _startListening: function () {
        if (this.iot_device) {
            this.iot_device.add_listener(this._onValueChange.bind(this));
            this.iot_device.action({ action: 'start_reading' });
        }
    },

    /**
     * @private
     */
    _stopListening: function () {
        if (this.iot_device) {
            this.iot_device.action({ action: 'stop_reading' });
            this.iot_device.remove_listener();
        }
    },
});

field_registry.add('field_many2one_iot_scale', FieldMany2OneIotScale);

return FieldMany2OneIotScale;
});
