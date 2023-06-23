/** @odoo-module **/

import BarcodePickingBatchModel from '@stock_barcode_picking_batch/models/barcode_picking_batch_model';
import MainComponent from '@stock_barcode/components/main';
import OptionLine from '@stock_barcode_picking_batch/components/option_line';

import { patch } from '@web/legacy/js/core/utils';

patch(MainComponent.prototype, 'stock_barcode_picking_batch', {
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    confirm: function (ev) {
        ev.stopPropagation();
        this.env.model.confirmSelection();
    },

    async exit(ev) {
        if (this.state.view === 'barcodeLines' && this.env.model.canBeProcessed &&
            this.env.model.needPickings && !this.env.model.needPickingType && this.env.model.pickingTypes) {
            this.env.model.record.picking_type_id = false;
            return this.env.model.trigger('update');
        }
        return await this._super(...arguments);
    },

    get isConfiguring() {
        return this.env.model.needPickingType || this.env.model.needPickings;
    },

    get displayActionButtons() {
        return this._super() && !this.isConfiguring;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _getModel: function () {
        const { resId, resModel, rpc, notification, orm } = this;
        if (this.resModel === 'stock.picking.batch') {
            return new BarcodePickingBatchModel(resModel, resId, { rpc, notification, orm });
        }
        return this._super(...arguments);
    },
});

MainComponent.components.OptionLine = OptionLine;
