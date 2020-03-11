odoo.define('web.control_panel_mobile_tests', function (require) {
    "use strict";

    const testUtils = require('web.test_utils');

    const createActionManager = testUtils.createActionManager;
    const { getHelpers: getCPHelpers } = testUtils.controlPanel;

    QUnit.module('Control Panel', {
        beforeEach: function () {
            this.actions = [{
                id: 1,
                name: "Yes",
                res_model: 'partner',
                type: 'ir.actions.act_window',
                views: [[false, 'list']],
            }];
            this.archs = {
                'partner,false,list': '<tree><field name="foo"/></tree>',
                'partner,false,search': `
                    <search>
                        <filter string="Active" name="my_projects" domain="[('boolean_field', '=', True)]"/>
                        <field name="foo" string="Foo"/>
                    </search>`,
            };
            this.data = {
                partner: {
                    fields: {
                        foo: { string: "Foo", type: "char" },
                        boolean_field: { string: "I am a boolean", type: "boolean" },
                    },
                    records: [
                        { id: 1, display_name: "First record", foo: "yop" },
                    ],
                },
            };
        },
    }, function () {

        QUnit.test('basic rendering', async function (assert) {
            assert.expect(2);

            const actionManager = await createActionManager({
                actions: this.actions,
                archs: this.archs,
                data: this.data,
            });
            await actionManager.doAction(1);

            assert.containsNone(document.body, '.o_control_panel .o_mobile_search',
                "search options are hidden by default");
            assert.containsOnce(actionManager, '.o_control_panel .o_enable_searchview',
                "should display a button to toggle the searchview");

            actionManager.destroy();
        });

        QUnit.test('mobile search: activate a filter through quick search', async function (assert) {
            assert.expect(7);

            let searchRPCFlag = false;

            const actionManager = await createActionManager({
                actions: this.actions,
                archs: this.archs,
                data: this.data,
                mockRPC: function (route, args) {
                    if (searchRPCFlag) {
                        assert.deepEqual(args.domain, [['foo', 'ilike', 'A']],
                            "domain should have been properly transferred to list view");
                    }
                    return this._super.apply(this, arguments);
                },
            });

            await actionManager.doAction(1);

            assert.containsOnce(document.body, 'button.o_enable_searchview.fa-search',
                "should display a button to open the searchview");
            assert.containsNone(document.body, '.o_searchview_input_container',
                "Quick search input should be hidden");

            // open the search view
            await testUtils.dom.click(document.querySelector('button.o_enable_searchview'));

            assert.containsOnce(document.body, '.o_toggle_searchview_full',
                "should display a button to expand the searchview");
            assert.containsOnce(document.body, '.o_searchview_input_container',
                "Quick search input should now be visible");

            searchRPCFlag = true;

            // use quick search input
            const cpHelpers = getCPHelpers(actionManager.el);
            await cpHelpers.editSearch("A");
            await cpHelpers.validateSearch();

            // close quick search
            await testUtils.dom.click(document.querySelector('button.o_enable_searchview.fa-close'));

            assert.containsNone(document.body, '.o_toggle_searchview_full',
                "Expand icon shoud be hidden");
            assert.containsNone(document.body, '.o_searchview_input_container',
                "Quick search input should be hidden");

            actionManager.destroy();
        });

        QUnit.test('mobile search: activate a filter in full screen search view', async function (assert) {
            assert.expect(3);

            const actionManager = await createActionManager({
                actions: this.actions,
                archs: this.archs,
                data: this.data,
            });

            await actionManager.doAction(1);

            assert.containsNone(document.body, '.o_mobile_search');

            // open the search view
            await testUtils.dom.click(actionManager.el.querySelector('button.o_enable_searchview'));
            // open it in full screen
            await testUtils.dom.click(actionManager.el.querySelector('.o_toggle_searchview_full'));

            assert.containsOnce(document.body, '.o_mobile_search');

            const cpHelpers = getCPHelpers(document.body, ".o_mobile_search");
            await cpHelpers.toggleFilterMenu();
            await cpHelpers.toggleMenuItem("Active");

            // closing search view
            await testUtils.dom.click(
                [...document.querySelectorAll('.o_mobile_search_button')].find(
                    e => e.innerText.trim() === "FILTER"
                )
            );
            assert.containsNone(document.body, '.o_mobile_search');

            actionManager.destroy();
        });
    });
});
