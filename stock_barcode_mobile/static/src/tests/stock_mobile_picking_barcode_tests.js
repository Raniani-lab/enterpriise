odoo.define('stock_mobile_barcode.stock_picking_barcode_tests', function (require) {
"use strict";

const mobile = require('web_mobile.core');
const { createWebClient, doAction } = require('@web/../tests/webclient/helpers');

QUnit.module('stock_mobile_barcode', {}, function () {

QUnit.module('Barcode', {
    beforeEach: function () {
        var self = this;

        this.clientData = {
            action: {
                tag: 'stock_barcode_picking_client_action',
                type: 'ir.actions.client',
                params: {
                    model: "stock.picking",
                },
                context: {},
            },
            currentState: [{
                location_id: {},
                location_dest_id: {},
                move_line_ids: [],
            }],
        };
        this.mockRPC = function (route, args) {
            if (route === '/stock_barcode/get_set_barcode_view_state') {
                return Promise.resolve(self.clientData.currentState);
            } else if (route === '/stock_barcode/static/img/barcode.svg') {
                return Promise.resolve();
            } else if (args.method === "get_all_products_by_barcode") {
                return Promise.resolve({});
            } else if (args.method === "get_all_locations_by_barcode") {
                return Promise.resolve({});
            }
        };
    }
});

QUnit.test('scan barcode button in mobile device', async function (assert) {
    assert.expect(1);
    this.clientData.currentState[0].group_stock_multi_locations = false;
    mobile.methods.scanBarcode = function () {};
    const webClient = await createWebClient({
        mockRPC: this.mockRPC,
    });
    await doAction(webClient, this.clientData.action);
    assert.containsOnce(webClient, '.o_stock_mobile_barcode');
    webClient.destroy();
});

});
});
