odoo.define('web_studio.ActionEditorActionTests', function (require) {
    "use strict";

    var testUtils = require('web.test_utils');

    var createActionManager = testUtils.createActionManager;

    QUnit.module('Studio', {
        beforeEach: function () {
            this.data = {
                kikou: {
                    fields: {
                        display_name: { type: "char" },
                        start: { type: 'datetime', store: 'true' },
                    },
                },
            };
        }
    }, function () {

        QUnit.module('ActionEditorAction');

        QUnit.test('add a gantt view', async function (assert) {
            assert.expect(5);

            var actionManager = await createActionManager({
                actions: this.actions,
                data: this.data,
                mockRPC: function (route, args) {
                    if (route === '/web_studio/add_view_type') {
                        assert.strictEqual(args.view_type, 'gantt',
                            "should add the correct view");
                        return Promise.resolve(false);
                    } else if (args.method === 'fields_get') {
                        assert.strictEqual(args.model, 'kikou',
                            "should read fields on the correct model");
                    }
                    return this._super.apply(this, arguments);
                },
            });
            await actionManager.doAction('action_web_studio_action_editor', {
                action: {
                    res_model: 'kikou',
                    view_mode: 'list',
                    views: [[1, 'list'], [2, 'form']],
                },
                noEdit: true,
            });

            await testUtils.dom.click(actionManager.$('.o_web_studio_view_type[data-type="gantt"] .o_web_studio_thumbnail'));

            assert.containsOnce($, '.o_web_studio_new_view_modal',
                "there should be an opened dialog to select gantt attributes");
            assert.strictEqual($('.o_web_studio_new_view_modal select[name="date_start"]').val(), 'start',
                "date start should be prefilled (mandatory)");
            assert.strictEqual($('.o_web_studio_new_view_modal select[name="date_stop"]').val(), 'start',
                "date stop should be prefilled (mandatory)");

            actionManager.destroy();
        });
    });

});
