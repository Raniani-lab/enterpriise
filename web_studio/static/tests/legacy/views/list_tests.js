odoo.define('web_studio.list_tests', function (require) {
"use strict";

const AbstractStorageService = require('web.AbstractStorageService');
const ListView = require('web.ListView');
const RamStorage = require('web.RamStorage');
const testUtils = require('web.test_utils');

QUnit.module('web_studio', {
    beforeEach: function () {
        this.data = {
            foo: {
                fields: {
                    foo: {string: "Foo", type: "char"},
                    bar: {string: "Bar", type: "boolean"},
                },
                records: [
                    {id: 1, bar: true, foo: "yop"},
                    {id: 2, bar: true, foo: "blip"},
                    {id: 3, bar: true, foo: "gnap"},
                    {id: 4, bar: false, foo: "blip"},
                ]
            }
        };

        this.RamStorageService = AbstractStorageService.extend({
            storage: new RamStorage(),
        });
    }
}, function () {

    QUnit.module('ListView');

    QUnit.test("add custom field button with other optional columns", async function (assert) {
        assert.expect(7);

        const list = await testUtils.createView({
            View: ListView,
            model: 'foo',
            data: this.data,
            arch: `
                <tree sample="1">
                    <field name="foo"/>
                    <field name="bar" optional="hide"/>
                </tree>`,
            session: {
                is_system: true
            },
            intercepts: {
                studio_icon_clicked: assert.step.bind(assert, 'studio_button_clicked'),
            },
        });

        assert.ok(list.$('.o_data_row').length > 0);
        assert.containsOnce(list.$('table'), '.o_optional_columns_dropdown_toggle');
        await testUtils.dom.click(list.$('table .o_optional_columns_dropdown_toggle'));
        const $dropdown = list.$('div.o_optional_columns');
        assert.containsOnce($dropdown, 'div.dropdown-item');
        assert.containsOnce($dropdown, 'button.dropdown-item-studio');

        await testUtils.dom.click(list.$('div.o_optional_columns button.dropdown-item-studio'));
        assert.containsNone(document.body, '.modal-studio');
        assert.verifySteps(['studio_button_clicked']);

        list.destroy();
    });

    QUnit.test("add custom field button without other optional columns", async function (assert) {
        assert.expect(7);

        const list = await testUtils.createView({
            View: ListView,
            model: 'foo',
            data: this.data,
            arch: `
                <tree sample="1">
                    <field name="foo"/>
                    <field name="bar"/>
                </tree>`,
            session: {
                is_system: true
            },
            intercepts: {
                studio_icon_clicked: assert.step.bind(assert, 'studio_button_clicked'),
            },
        });

        assert.ok(list.$('.o_data_row').length > 0);
        assert.containsOnce(list.$('table'), '.o_optional_columns_dropdown_toggle');
        await testUtils.dom.click(list.$('table .o_optional_columns_dropdown_toggle'));
        const $dropdown = list.$('div.o_optional_columns');
        assert.containsNone($dropdown, 'div.dropdown-item');
        assert.containsOnce($dropdown, 'button.dropdown-item-studio');

        await testUtils.dom.click(list.$('div.o_optional_columns button.dropdown-item-studio'));
        assert.containsNone(document.body, '.modal-studio');
        assert.verifySteps(['studio_button_clicked']);

        list.destroy();
    });
});
});
