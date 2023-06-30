/** @odoo-module **/

import BarcodeMRPModel from '@stock_barcode_mrp/models/barcode_mrp_model';
import { patch } from 'web.utils';

patch(BarcodeMRPModel.prototype, 'stock_barcode_quality_mrp', {
    openQualityChecksMethod: 'check_quality',

    get displayValidateButton() {
        return !(this.record && this.record.quality_check_todo) && this._super.apply(this, arguments);
    }
});
