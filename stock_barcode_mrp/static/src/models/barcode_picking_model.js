/** @odoo-module **/

import BarcodePickingModel from '@stock_barcode/models/barcode_picking_model';

import { patch } from 'web.utils';
import { _t } from 'web.core';

patch(BarcodePickingModel.prototype, 'stock_barcode_mrp_barcode_picking_model', {
    validate: async function () {
        const _super = this._super.bind(this);
        if (_.any(this.currentState.lines, line => line.product_id.is_kits)) {
            await this.save();
            // If immediate transfer, `auto_confirm` has confirmed the moves. Else, we have to confirm them ourselves
            if (!this.record.immediate_transfer) {
                await this.orm.call(
                    this.params.model,
                    'action_confirm',
                    [this.recordIds],
                );
            }
            this.trigger('refresh');
            this.notification.add(_t("The lines with a kit have been replaced with their components. Please check the picking before the final validation."), {type: 'danger'});
        } else {
            _super();
        }
    },
});
