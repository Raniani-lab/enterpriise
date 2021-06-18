odoo.define('stock_barcode.inventory_client_action', function (require) {
'use strict';

var core = require('web.core');
var ClientAction = require('stock_barcode.ClientAction');
var ViewsWidget = require('stock_barcode.ViewsWidget');
const session = require('web.session');

var _t = core._t;

var InventoryClientAction = ClientAction.extend({
    custom_events: _.extend({}, ClientAction.prototype.custom_events, {
        picking_print_inventory: '_onPrintInventory'
    }),

    init: function (parent, action) {
        this._super.apply(this, arguments);
        this.commands['O-BTN.validate'] = this._validate.bind(this);
        this.commands['O-BTN.cancel'] = this._cancel.bind(this);
        this.mode = 'inventory';
        this.actionParams.id = false;
        this.actionParams.model = 'stock.quant';
        this.methods = {
            validate: 'action_validate',
        };
    },

    willStart: function () {
        var self = this;
        var res = this._super.apply(this, arguments);
        res.then(function () {
            if (self.currentState.group_stock_multi_locations === false) {
                self.mode = 'no_multi_locations';
            } else  {
                self.mode = 'inventory';
            }
            if (self.currentState.state === 'done') {
                self.mode = 'done';
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
    _createLineCommand: function (line) {
        return [0, 0, {
            product_id:  line.product_id.id,
            inventory_quantity: line.inventory_quantity,
            location_id: line.location_id.id,
            lot_id: line.lot_id && line.lot_id[0],
            package_id: line.package_id && line.package_id[0],
            owner_id: line.owner_id && line.owner_id[0],
            user_id: line.user_id,
            dummy_id: line.virtual_id,
            inventory_date: new Date().toJSON(),
        }];
    },

    /**
     * @override
     */
    _getAddLineDefaultValues: function (currentPage) {
        const values = this._super(currentPage);
        values.default_inventory_quantity = 1;
        values.active_model = 'stock.quant';
        values.default_id = false;
        values.default_user_id = session.user_context.uid;
        values.default_inventory_date = new Date().toJSON();
        return values;
    },

    /**
     * @override
     */
    _getWriteableFields: function () {
        return ['inventory_quantity'];
    },

    /**
     * @override
     */
    _getLinesField: function () {
        // FIXME: This is now a throwaway placeholder to simplify controller write code
        return 'line_ids';
    },

    /**
     * @override
     */
     _getPageFields: function (options) {
         if (options && options.line) {
            return [
                ['location_id', 'location_id.id'],
                ['location_name', 'location_id.display_name'],
            ];
         }
         return [
             ['location_id', 'location_ids.0.id'],
             ['location_name', 'location_ids.0.display_name'],
         ];
     },

    /**
     * @override
     */
    _getLines: function (state) {
        return state.line_ids;
    },

    /**
     * @override
     */
    _getQuantityField: function () {
        return 'inventory_quantity';
    },

    /**
     * @override
     */
    _instantiateViewsWidget: function (defaultValues, params) {
        return new ViewsWidget(
            this,
            'stock.quant',
            'stock_barcode.stock_quant_barcode',
            defaultValues,
            Object.assign(params || {}, {'context': {'inventory_mode': true}})
        );
    },

    _lineIsEmpty: function (line) {
        return line.virtual_id && !line.inventory_quantity && !line.lot_id;
    },

    _lineIsFromAnotherLot: function (line, lotId) {
        return lotId && line.lot_id && line.lot_id[0] !== lotId;
    },

    _lineIsTrackedAndComplete (line, product) {
        return product.tracking === 'serial' && line.inventory_quantity > 0;
    },

    /**
     * @override
     */
    _lot_name_used: function (product, lot_name) {
        var lines = this._getLines(this.currentState);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.inventory_quantity !== 0 && line.product_id.id === product.id &&
                line.lot_id && line.lot_id[1] === lot_name) {
                return true;
            }
        }
        return false;
    },

    /**
     * @override
     */
    _makeNewLine: function (params) {
        let newLine = this._super(...arguments);
        newLine = Object.assign(newLine, {
            owner_id: params.owner_id,
            inventory_quantity: params.qty_done,
            product_uom_id: params.product.uom_id[0],
            quantity: 0,
            inventory_quantity: params.qty_done,
            user_id: session.user_context.uid,
        });
        return newLine;
    },

    /**
     * @override
     */
     _validate: function () {
        const superValidate = this._super.bind(this);
        this.mutex.exec(() => {
            return superValidate().then(() => {
                this.displayNotification({
                    message: _t("The inventory adjustment has been validated"),
                    type: 'success',
                });
                return this.trigger_up('exit');
            });
        });
    },

    /**
     * @override
     */
    _updateLineCommand: function (line) {
        return [1, line.id, {
            inventory_quantity : line.inventory_quantity,
        }];
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Handles the `print_inventory` OdooEvent. It makes an RPC call
     * to the method 'do_action' on a 'ir.action_window' with the additional context
     * needed
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onPrintInventory: function (ev) {
        ev.stopPropagation();
        var self = this;
        this.mutex.exec(function () {
            return self._save().then(function () {
                var active_ids = Object.keys(self.currentState.line_ids).map(k=>self.currentState.line_ids[k].id)
                return self.do_action(self.currentState.actionReportInventory, {
                    'additional_context': {
                        // 'active_id': self.actionParams.id,
                        'active_ids': [active_ids],
                        'active_model': 'stock.quant',
                    }
                });
            });
        });
    },

});

core.action_registry.add('stock_barcode_inventory_client_action', InventoryClientAction);

return InventoryClientAction;

});
