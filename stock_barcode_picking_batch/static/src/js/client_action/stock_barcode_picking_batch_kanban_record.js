odoo.define('stock_barcode.BatchPickingKanbanRecord', function (require) {
'use strict';

const KanbanRecord = require('web.KanbanRecord');

const StockBarcodePickingBatch = KanbanRecord.include({
    /**
     * @override
     * @private
     */
    _openRecord: function () {
        if (this.modelName === 'stock.picking.batch' && this.$el.parents('.o_stock_barcode_kanban').length) {
            this.do_action({
                type: 'ir.actions.client',
                tag: 'stock_barcode_picking_batch_client_action',
                params: {
                    'model': 'stock.picking.batch',
                    'picking_batch_id': this.id,
                }
            });
        } else {
            this._super.apply(this, arguments);
        }
    }
});

return StockBarcodePickingBatch;
});
