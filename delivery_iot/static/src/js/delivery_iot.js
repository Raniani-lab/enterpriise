odoo.define('delivery.iot', function (require) {
'use strict';

var FieldMany2One = require('web.relational_fields').FieldMany2One;
var iot_widgets = require('iot.widgets');
var field_registry = require('web.field_registry');

var FieldMany2OneIotScale = FieldMany2One.extend(iot_widgets.IotValueFieldMixin, {
    template: "FieldMany2OneIotScale",
    events: _.extend({}, FieldMany2One.prototype.events, {
        'click .o_read_weight': '_onClickReadWeight',
    }),

    _onClickReadWeight: function () {
        this.iot_device.action({ action: 'read_once' });
    },

    /**
     * @override
     */
    _reset: function () {
        this._super.apply(this, arguments);
        if (!this.iot_device || this.iot_device._identifier != this.recordData.iot_device_identifier) {
            this._stopListening();
            this._getDeviceInfo();
            this._startListening();
        }
    },

    _renderEdit: function () {
        this._super.apply(this, arguments);
        if (this.manual_measurement) {
            this.$el.find('.o_read_weight').removeClass('o_hidden');
        } else {
            this.$el.find('.o_read_weight').addClass('o_hidden');
        }
    },

    /**
     * @override
     */
    _getDeviceInfo: function () {
        iot_widgets.IotValueFieldMixin._getDeviceInfo.apply(this);
        this.manual_measurement = this.recordData[this.attrs.options.manual_measurement_field];
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
        if (this.iot_device && !this.manual_measurement) {
            this.iot_device.action({ action: 'start_reading' });
        }
    },

    /**
     * @override
     */
    _stopListening: function () {
        if (this.iot_device && !this.manual_measurement) {
            this.iot_device.action({ action: 'stop_reading' });
        }
        iot_widgets.IotValueFieldMixin._stopListening.apply(this);
    },
});

field_registry.add('field_many2one_iot_scale', FieldMany2OneIotScale);

return FieldMany2OneIotScale;
});
