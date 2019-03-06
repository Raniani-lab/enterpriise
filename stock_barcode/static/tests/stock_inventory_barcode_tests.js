odoo.define('stock_barcode.stock_inventory_barcode_tests', function (require) {
"use strict";

var barcodeEvents = require('barcodes.BarcodeEvents');

var FormView = require('web.FormView');
var testUtils = require('web.test_utils');

var createView = testUtils.createView;
var triggerKeypressEvent = testUtils.dom.triggerKeypressEvent;

QUnit.module('stock_barcode', {}, function () {

QUnit.module('Barcode', {
    beforeEach: function () {
        this.data = {
            product: {
                fields: {
                    name: {string : "Product name", type: "char"},
                },
                records: [{
                    id: 1,
                    name: "Large Cabinet",
                }, {
                    id: 4,
                    name: "Cabinet with Doors",
                }],
            },
            'stock.inventory.line': {
                fields: {
                    product_id: {string: "Product", type: 'many2one', relation: 'product'},
                    theoretical_qty: {string: "Theoretical Quantity", type: 'float', digits: [16,1]},
                    product_qty: {string: "Done", type: 'float', digits: [16,1]},
                    product_barcode: {string: "Product Barcode", type: 'char'},
                },
                records: [{
                    id: 3,
                    product_id: 1,
                    theoretical_qty: 2.0,
                    product_qty: 0.0,
                    product_barcode: "543982671252",
                }, {
                    id: 5,
                    product_id: 4,
                    theoretical_qty: 2.0,
                    product_qty: 0.0,
                    product_barcode: "678582670967",
                }],
            },
            stock_inventory: {
                fields: {
                    _barcode_scanned: {string: "Barcode Scanned", type: 'char'},
                    line_ids: {
                        string: "one2many field",
                        relation: 'stock.inventory.line',
                        type: 'one2many',
                    },
                },
                records: [{
                    id: 2,
                    line_ids: [3],
                }, {
                    id: 5,
                    line_ids: [5],
                }],
            },
        };
    }
});

QUnit.test('scan a product with qty keypress (no tracking)', async function (assert) {
    assert.expect(4);

    var delay = barcodeEvents.BarcodeEvents.max_time_between_keys_in_ms;
    barcodeEvents.BarcodeEvents.max_time_between_keys_in_ms = 0;


    var form = await createView({
        View: FormView,
        model: 'stock_inventory',
        data: this.data,
        arch: '<form string="Products">' +
                '<field name="_barcode_scanned" widget="inventory_barcode_handler"/>' +
                '<sheet>' +
                    '<notebook>' +
                        '<page string="Inventory">' +
                            '<field name="line_ids">' +
                                '<tree>' +
                                    '<field name="product_id"/>' +
                                    '<field name="theoretical_qty"/>' +
                                    '<field name="product_qty"/>' +
                                    '<field name="product_barcode"/>' +
                                '</tree>' +
                            '</field>' +
                        '</page>' +
                    '</notebook>' +
                '</sheet>' +
            '</form>',
        res_id: 2,
        viewOptions: {
            mode: 'edit',
        },
    });

    assert.strictEqual(form.$('.o_data_row .o_data_cell:nth(2)').text(), '0.0',
        "quantity checked should be 0");

    var defs = ['5','4','3','9','8','2','6','7','1','2','5','2','Enter'].map(async function(i) {
        await triggerKeypressEvent(i);
    });
    await defs;
    // Quantity listener should open a dialog.
    await triggerKeypressEvent('5');
    await testUtils.nextTick();

    assert.strictEqual($('.modal .modal-body').length, 1, 'should open a modal with a quantity as input');
    assert.strictEqual($('.modal .modal-body .o_set_qty_input').val(), '5', 'the quantity by default in the modal shoud be 5');

    await testUtils.fields.editInput($('.modal .modal-body .o_set_qty_input'), '7');

    await testUtils.fields.triggerKey('press', $('.modal .modal-body .o_set_qty_input'), 'enter');
    assert.strictEqual(form.$('.o_data_row .o_data_cell:nth(2)').text(), '7.0',
        "quantity checked should be 7");
    form.destroy();
    barcodeEvents.BarcodeEvents.max_time_between_keys_in_ms = delay;
});


});
});
