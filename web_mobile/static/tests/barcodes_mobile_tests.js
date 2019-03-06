odoo.define('web_mobile.barcode.tests', function (require) {
    "use strict";

    var field_registry = require('web.field_registry');
    var FormView = require('web.FormView');
    var relational_fields = require('web.relational_fields');
    var testUtils = require('web.test_utils');

    var barcode_fields = require('web_mobile.barcode_fields');
    var mobile = require('web_mobile.rpc');

    var createView = testUtils.createView;

    var NAME_SEARCH = "name_search";
    var PRODUCT_PRODUCT = 'product.product';
    var SALE_ORDER_LINE = 'sale_order_line';
    var PRODUCT_FIELD_NAME = 'product_id';

    QUnit.module('web_mobile', {
        beforeEach: function () {
            this.data = {
                [PRODUCT_PRODUCT]: {
                    fields: {
                        id: {type: 'integer'},
                        name: {},
                        barcode: {},
                    },
                    records: [{
                        id: 111,
                        name: 'product_cable_management_box',
                        barcode: '601647855631',
                    }]
                },
                [SALE_ORDER_LINE]: {
                    fields: {
                        id: {type: 'integer'},
                        [PRODUCT_FIELD_NAME]: {
                            string: PRODUCT_FIELD_NAME,
                            type: 'many2one',
                            relation: PRODUCT_PRODUCT
                        },
                        product_uom_qty: {type: 'integer'}
                    }
                },
            };
        },
    }, function () {

        QUnit.test("web_mobile: barcode button in a mobile environment", async function (assert) {
            var self = this;

            assert.expect(2);

            // simulate a mobile environment
            field_registry.add('many2one_barcode', barcode_fields);
            var __many2oneDialog = mobile.methods.many2oneDialog;
            var __scanBarcode = mobile.methods.scanBarcode;
            var __showToast = mobile.methods.showToast;
            var __vibrate = mobile.methods.vibrate;

            mobile.methods.many2oneDialog = function (args) {
                // Check if we have one result minimum (1 result + create + create and edit)
                if (args.records.length >= 3) {
                    return Promise.resolve({'data': {'action': 'select', 'value': {'id': args.records[0].id}}});
                } else {
                    return Promise.resolve({'data': {'action': 'cancel'}});
                }
            };

            mobile.methods.scanBarcode = function () {
                return Promise.resolve({
                    'data': self
                        .data[PRODUCT_PRODUCT]
                        .records[0]
                        .barcode
                });
            };

            mobile.methods.showToast = function (data) {};

            mobile.methods.vibrate = function () {};

            var form = await createView({
                View: FormView,
                arch:
                    '<form>' +
                        '<sheet>' +
                            '<field name="' + PRODUCT_FIELD_NAME + '" widget="many2one_barcode"/>' +
                        '</sheet>' +
                    '</form>',
                data: this.data,
                model: SALE_ORDER_LINE,
                mockRPC: function (route, args) {
                    if (args.method === NAME_SEARCH && args.model === PRODUCT_PRODUCT) {
                        return this._super.apply(this, arguments).then(function (result) {
                            var records = self
                                .data[PRODUCT_PRODUCT]
                                .records
                                .filter(function (record) {
                                    return record.barcode === args.kwargs.name;
                                })
                                .map(function (record) {
                                    return [record.id, record.name];
                                })
                            ;
                            return records.concat(result);
                        });
                    }
                    return this._super.apply(this, arguments);
                },
            });

            var $scanButton = form.$('.o_barcode_mobile');

            assert.equal($scanButton.length, 1, "has scanner button");

            await testUtils.dom.click($scanButton);

            var selectedId = form.renderer.state.data[PRODUCT_FIELD_NAME].res_id;
            assert.equal(selectedId, self.data[PRODUCT_PRODUCT].records[0].id,
                "product found and selected (" +
                self.data[PRODUCT_PRODUCT].records[0].barcode + ")");

            mobile.methods.vibrate = __vibrate;
            mobile.methods.showToast = __showToast;
            mobile.methods.scanBarcode = __scanBarcode;
            mobile.methods.many2oneDialog = __many2oneDialog;
            field_registry.add('many2one_barcode', relational_fields.FieldMany2One);

            form.destroy();
        });
    });
});
