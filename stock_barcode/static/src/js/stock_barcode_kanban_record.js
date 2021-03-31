odoo.define('stock_barcode.BarcodeKanbanRecord', function (require) {
"use strict";

var KanbanRecord = require('web.KanbanRecord');

var StockBarcodeKanbanRecord = KanbanRecord.extend({
    /**
     * @override
     * @private
     */
    _openRecord: function () {
        if (this.modelName === 'stock.picking' && $('.modal-dialog').length === 0) {
            this.$('button').first().click();
        } else {
            this._super.apply(this, arguments);
        }
    }
});

return StockBarcodeKanbanRecord;

});

odoo.define('stock_barcode.BarcodeKanbanController', function (require) {
"use strict";
var KanbanController = require('web.KanbanController');

var StockBarcodeKanbanController = KanbanController.extend({
    custom_events: Object.assign({}, KanbanController.prototype.custom_events, {
        kanban_scan_barcode: '_onBarcodeScannedHandler',
    }),

    // --------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called by the kanban renderer when the user scans a barcode.
     *
     * @param {OdooEvent} ev
     */
    _onBarcodeScannedHandler: function (ev) {
        if (!['stock.picking'].includes(this.modelName)) {
            return;
        }
        const {barcode} = ev.data;
        this._rpc({
            model: this.modelName,
            method: 'filter_on_product',
            kwargs: {
                barcode,
                context: this.initialState.context,
            }
        }).then(result => {
            if (result.action) {
                this.do_action(result.action, {
                    replace_last_action: true,
                });
            } else if (result.warning) {
                this.do_warn(result.warning.title, result.warning.message);
            }
        });
    },

    /**
     * Do not add a record but open new barcode views.
     *
     * @private
     * @override
     */
    _onButtonNew: function (ev) {
        if (this.modelName === 'stock.picking') {
            this._rpc({
                model: 'stock.picking',
                method: 'open_new_picking',
                context: this.initialState.context,
            }).then((result) => {
                this.do_action(result.action);
            });
        } else {
            this._super(...arguments);
        }
    },
});
return StockBarcodeKanbanController;

});
