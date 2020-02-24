odoo.define('stock_barcode.BatchPickingClientAction', function (require) {
'use strict';

const core = require('web.core');
const PickingClientAction = require('stock_barcode.picking_client_action');
const ViewsWidget = require('stock_barcode.ViewsWidget');

const _t = core._t;

const BatchPickingClientAction = PickingClientAction.extend({
    custom_events: Object.assign({}, PickingClientAction.prototype.custom_events, {
        'print_picking_batch': '_onPrintPickingBatch',
    }),

    init: function (parent, action) {
        this._super.apply(this, arguments);
        this.actionParams.model = 'stock.picking.batch';
        this.actionParams.id = action.params.picking_batch_id;
        this.methods.validate = 'action_done';
        this.viewInfo = 'stock_barcode_picking_batch.stock_barcode_batch_picking_view_info';
    },

    willStart: function () {
        const res = this._super.apply(this, arguments);
        res.then(() => {
            if (this.currentState.state === 'draft') {
                this.mode = 'draft';
            }
        });
        return res;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getAddLineDefaultValues: function (currentPage) {
        const values = this._super(currentPage);
        values.default_batch_id = this.currentState.id;
        values.default_picking_id = this.currentState.picking_ids[0].id;
        return values;
    },

    /**
     * @override
     */
    _instantiateViewsWidget: function (defaultValues, params) {
        return new ViewsWidget(
            this,
            'stock.move.line',
            'stock_barcode_picking_batch.stock_move_line_product_selector_inherit',
            defaultValues,
            params
        );
    },

    /**
     * @override
     */
    _isAbleToCreateNewLine: function () {
        return false;
    },

    /**
     * @override
     */
    _isControlButtonsEnabled: function () {
        return this.mode !== 'draft';
    },

    /**
     * @override
     */
    _isOptionalButtonsEnabled: function () {
        return this.mode !== 'draft';
    },

    /**
     * @override
     */
    _makePages: function () {
        if (!this.currentState.picking_ids.length) {
            // Don't create any pages if the record is empty.
            return [];
        }
        return this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    _notify_cancellation: function () {
        this.do_notify(_t("Cancel"), _t("The batch picking has been cancelled"));
    },

    /**
     * Call `action_print` on the `picking.batch.model` to save the batch
     * picking as a pdf.
     * @private
     */
    _printPickingBatch: function () {
        this.mutex.exec(() => {
            return this._save().then(() => {
                return this._rpc({
                    'model': 'stock.picking.batch',
                    'method': 'action_print',
                    'args': [[this.actionParams.id]],
                }).then((res) => {
                    return this.do_action(res);
                });
            });
        });
    },

    /**
     * @override
     */
    _validate: function () {
        this._super({ barcode_view: true });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the `print_picking_batch` OdooEvent.
     * It makes an RPC call to the method 'action_print'.
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPrintPickingBatch: function (ev) {
        ev.stopPropagation();
        this._printPickingBatch();
    },
});

core.action_registry.add('stock_barcode_picking_batch_client_action', BatchPickingClientAction);

return BatchPickingClientAction;

});
