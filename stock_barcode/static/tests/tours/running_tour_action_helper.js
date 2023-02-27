odoo.define('stock_barcode.RunningTourActionHelper', function(require) {
"use strict";

const { RunningTourActionHelper } = require('@web_tour/tour_service/tour_utils');
const { patch } = require("@web/core/utils/patch");

patch(RunningTourActionHelper.prototype, 'stock_barcode.RunningTourActionHelper', {
    _scan(element, barcode) {
        odoo.__DEBUG__.services['web.core'].bus.trigger('barcode_scanned', barcode, element);
    },
    scan(barcode, element) {
        this._scan(this._get_action_values(element), barcode);
    },
});

});
