odoo.define('delivery.iot', function (require) {
'use strict';

var FieldMany2One = require('web.relational_fields').FieldMany2One;
var iot_widgets = require('iot.widgets');
var field_registry = require('web.field_registry');

var FieldMany2OneIotScale = FieldMany2One.extend(iot_widgets.IotValueFieldMixin, {

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
     * @override
     */
    _startListening: function () {
        iot_widgets.IotValueFieldMixin._startListening.apply(this);
        if (this.iot_device) {
            this.iot_device.action({ action: 'start_reading' });
        }
    },

    /**
     * @override
     */
    _stopListening: function () {
        if (this.iot_device) {
            this.iot_device.action({ action: 'stop_reading' });
        }
        iot_widgets.IotValueFieldMixin._stopListening.apply(this);
    },
});

field_registry.add('field_many2one_iot_scale', FieldMany2OneIotScale);

return FieldMany2OneIotScale;
});
