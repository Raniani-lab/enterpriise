odoo.define('quality_mrp_iot.iot_picture', function (require) {
"use strict";

var registry = require('web.field_registry');

var MrpWorkorderWidgets = require('mrp_workorder.update_kanban');
var TabletImage = MrpWorkorderWidgets.TabletImage;

var TabletImageIot = TabletImage.extend({
    events: _.extend({}, TabletImage.prototype.events, {
        'click .o_input_file': function (ev) {
            ev.stopImmediatePropagation();
            if (this.ip) {
                ev.preventDefault();
                this._onButtonClick();
            }
        },
    }),

    init: function () {
        this._super.apply(this, arguments);
        var ipField = this.nodeOptions.ip_field;
        this.ip = this.record.data[ipField];
        var identifierField = this.nodeOptions.identifier;
        this.identifier = this.record.data[identifierField];
    },

    _onButtonClick: function (ev) {
        var url = this.ip + "/hw_drivers/driveraction/camera";
        var data = {'action': 'camera', 'identifier': this.identifier};
        var self = this;
        return $.ajax({
            type: 'POST',
            url: url,
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(data),
            success: function (response) {
                self._setValue(response['result']['image']);
                self._render();
            }
        });
    },
});

registry.add('iot_picture', TabletImageIot);

return TabletImageIot;
});