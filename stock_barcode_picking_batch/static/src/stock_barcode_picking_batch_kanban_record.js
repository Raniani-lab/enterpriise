odoo.define('stock_barcode.BatchPickingKanbanController', function (require) {
    "use strict";

const StockBarcodeKanbanController = require('stock_barcode.BarcodeKanbanController');

StockBarcodeKanbanController.include({
    // --------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    /**
     * Add a new batch picking from barcode
     *
     * @private
     * @override
     */
    _onButtonNew: function (ev) {
        if (this.modelName === 'stock.picking.batch') {
            this._rpc({
                model: 'stock.picking.batch',
                method: 'open_new_batch_picking',
            }).then((result) => {
                this.do_action(result.action);
            });
        } else {
            this._super(...arguments);
        }
    },
});
});
