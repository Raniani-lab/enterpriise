odoo.define('stock_barcode.InventoryAdjustmentKanbanRecord', function (require) {
"use strict";

var KanbanRecord = require('web.KanbanRecord');

var StockBarcodeKanbanRecord = KanbanRecord.extend({
    /**
     * @override
     * @private
     */
    _openRecord: function () {
        if (this.modelName === 'stock.inventory' && this.$el.parents('.o_stock_barcode_kanban').length) {
            this.do_action({
                type: 'ir.actions.client',
                tag: 'stock_barcode_inventory_client_action',
                params: {
                    'model': 'stock.inventory',
                    'inventory_id': this.id,
                }
            });
        } else {
            this._super.apply(this, arguments);
        }
    }
});

return StockBarcodeKanbanRecord;

});

odoo.define('stock_barcode.InventoryAdjustmentKanbanController', function (require) {
"use strict";
var KanbanController = require('web.KanbanController');

var StockBarcodeKanbanController = KanbanController.extend({
    // --------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Do not add a record but open new barcode views.
     *
     * @private
     * @override
     */
    _onButtonNew: function (ev) {
        var self = this;
        var viewType = this.actionViews[0] && this.actionViews[0].type;
        if (viewType === 'kanban' && this.modelName === 'stock.inventory') {
            this._rpc({
                    model: 'stock.inventory',
                    method: 'open_new_inventory',
                })
                .then(function (result) {
                    self.do_action(result);
                });
        } else {
            this._super.apply(this, arguments);
        }
    },
});
return StockBarcodeKanbanController;

});
