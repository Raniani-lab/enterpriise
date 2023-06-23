/** @odoo-module **/

import BarcodePickingModel from '@stock_barcode/models/barcode_picking_model';

import { patch } from '@web/legacy/js/core/utils';
import { _t } from "@web/legacy/js/services/core";

patch(BarcodePickingModel.prototype, 'stock_barcode_mrp_barcode_picking_model', {
    validate: async function () {
        const _super = this._super.bind(this);
        if (this.currentState.lines.some(line => line.product_id.is_kits)) {
            await this.save();
            const move_ids = this.currentState.lines.reduce((mvIds, line) => line.product_id.is_kits ? [...mvIds, line.move_id] : mvIds, []);
            await this.orm.call(
                'stock.move',
                'action_explode',
                move_ids,
            );
            this.trigger('refresh');
            return this.notification(_t("The lines with a kit have been replaced with their components. Please check the picking before the final validation."), {type: 'danger'});
        } else {
            return await _super();
        }
    },
});
