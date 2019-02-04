odoo.define('quality_control_iot.iot_mesaure', function (require) {
    "use strict";

var core = require('web.core');
var Widget = require('web.Widget');
var widget_registry = require('web.widget_registry');
var py_eval = require('web.py_utils').py_eval;

var IoTCoreMixin = require('iot.widgets').IoTCoreMixin;

var _t = core._t;


var IotTakeMeasureButton = Widget.extend(IoTCoreMixin, {
    tagName: 'button',
    className: 'btn btn-primary',
    events: {
        'click': '_onButtonClick',
    },

    /**
     * @override
     */
    init: function (parent, record, node) {
        this.record = record;
        this.options = py_eval(node.attrs.options);
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    start: function () {
        this._super.apply(this, arguments);
        this.$el.text(_t('Take Measure'));
        this.$el.attr('barcode_trigger', 'measure');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onButtonClick: function () {
        var self = this;
        var identifier = this.record.data[this.options.identifier_field];
        var composite_url = this._url() + "/hw_drivers/driverdetails/" + identifier;
        var measure_field = this.options.measure_field;

        return this._callIotDevice(composite_url, null, this._url()).done(function (measure) {
            var changes = {};
            changes[measure_field] = parseFloat(measure);
            self.trigger_up('field_changed', {
                dataPointID: self.record.id,
                changes: changes,
            });
        });
    },
});

widget_registry.add('iot_take_measure_button', IotTakeMeasureButton);

return {
    IotTakeMeasureButton: IotTakeMeasureButton,
};

});
