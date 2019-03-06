odoo.define('sign.document_backend_tests', function (require) {
"use strict";

var testUtils = require('web.test_utils');
var createActionManager = testUtils.createActionManager;

QUnit.module('document_backend_tests', function () {
    QUnit.test('simple rendering', async function (assert) {
        assert.expect(1);

        var actionManager = await createActionManager({
            actions: [{
                id: 9,
                name: 'A Client Action',
                tag: 'sign.Document',
                type: 'ir.actions.client',
                context: {id: 5, token: 'abc'},
            }],
            mockRPC: function (route) {
                if (route === '/sign/get_document/5/abc') {
                    return Promise.resolve('<span>def</span>');
                }
                return this._super.apply(this, arguments);
            },
        });


        await actionManager.doAction(9);

        assert.strictEqual(actionManager.$('.o_sign_document').text().trim(), 'def',
            'should display text from server');

        actionManager.destroy();
    });

    QUnit.test('do not crash when leaving the action', async function (assert) {
        assert.expect(0);

        var actionManager = await createActionManager({
            actions: [{
                id: 9,
                name: 'A Client Action',
                tag: 'sign.Document',
                type: 'ir.actions.client',
                context: {id: 5, token: 'abc'},
            }],
            mockRPC: function (route) {
                if (route === '/sign/get_document/5/abc') {
                    return Promise.resolve('<span>def</span>');
                }
                return this._super.apply(this, arguments);
            },
        });


        await actionManager.doAction(9);
        await actionManager.doAction(9);

        actionManager.destroy();
    });

});

});
