odoo.define('web_enterprise.relational_fields_mobile_tests', function (require) {
"use strict";

var FormView = require('web.FormView');
var testUtils = require('web.test_utils');

var createView = testUtils.createView;

QUnit.module('web_enterprise', {}, function () {

QUnit.module('relational_fields', {
    beforeEach: function () {
        this.data = {
            partner: {
                fields: {
                    display_name: { string: "Displayed name", type: "char" },
                    trululu: {string: "Trululu", type: "many2one", relation: 'partner'},
                },
                records: [{
                    id: 1,
                    display_name: "first record",
                    trululu: 4,
                }, {
                    id: 2,
                    display_name: "second record",
                    trululu: 1,
                }, {
                    id: 4,
                    display_name: "aaa",
                }],
            },
        };
    }
}, function () {

    QUnit.module('FieldStatus');

    QUnit.test('statusbar is rendered correclty on small devices', function (assert) {
        assert.expect(7);

        var form = createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch:
                '<form string="Partners">' +
                    '<header><field name="trululu" widget="statusbar"/></header>' +
                    '<field name="display_name"/>' +
                '</form>',
            res_id: 1,
        });

        assert.strictEqual(form.$('.o_statusbar_status > button:contains(aaa)').length, 1,
            "should have only one visible status in mobile, the active one");
        assert.containsOnce(form, '.o_statusbar_status .dropdown-menu',
            "should have a dropdown containing all status");
        assert.containsNone(form, '.o_statusbar_status .dropdown-menu:visible',
            "dropdown should be hidden");

        // open the dropdown
        testUtils.dom.click(form.$('.o_statusbar_status > button'));
        assert.containsOnce(form, '.o_statusbar_status .dropdown-menu:visible',
            "dropdown should be visible");
        assert.containsN(form, '.o_statusbar_status .dropdown-menu button', 3,
            "should have 3 status");
        assert.containsN(form, '.o_statusbar_status button:disabled', 3,
            "all status should be disabled");
        var $activeStatus = form.$('.o_statusbar_status .dropdown-menu button[data-value=4]');
        assert.hasClass($activeStatus,'btn-primary', "active status should be btn-primary");

        form.destroy();
    });

    QUnit.test('statusbar with no status on extra small screens', function (assert) {
        assert.expect(9);

        var form = createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch:'<form string="Partners">' +
                    '<header><field name="trululu" widget="statusbar"/></header>' +
                '</form>',
            res_id: 4,
        });

        assert.hasClass(form.$('.o_statusbar_status'),'o_field_empty',
            'statusbar widget should have class o_field_empty');
        assert.strictEqual(form.$('.o_statusbar_status').children().length, 2,
            'statusbar widget should have two children');
        assert.containsOnce(form, '.o_statusbar_status button.dropdown-toggle',
            'statusbar widget should have a button');
        assert.strictEqual(form.$('.o_statusbar_status button.dropdown-toggle').text().trim(), '',
            'statusbar button has no text');  // Behavior as of saas-15, might be improved
        assert.containsOnce(form, '.o_statusbar_status .dropdown-menu',
            'statusbar widget should have a dropdown menu');
        assert.containsN(form, '.o_statusbar_status .dropdown-menu button', 3,
            'statusbar widget dropdown menu should have 3 buttons');
        assert.strictEqual(form.$('.o_statusbar_status .dropdown-menu button').eq(0).text().trim(), 'first record',
            'statusbar widget dropdown first button should display the first record display_name');
        assert.strictEqual(form.$('.o_statusbar_status .dropdown-menu button').eq(1).text().trim(), 'second record',
            'statusbar widget dropdown second button should display the second record display_name');
        assert.strictEqual(form.$('.o_statusbar_status .dropdown-menu button').eq(2).text().trim(), 'aaa',
            'statusbar widget dropdown third button should display the third record display_name');
        form.destroy();
    });

    QUnit.test('clickable statusbar widget on mobile view', function (assert) {
        assert.expect(5);

        var form = createView({
            View: FormView,
            model: 'partner',
            data: this.data,
            arch:'<form string="Partners">' +
                    '<header><field name="trululu" widget="statusbar" options=\'{"clickable": "1"}\'/></header>' +
                '</form>',
            res_id: 1,
        });

        var $selectedStatus = form.$('.o_statusbar_status button[data-value="4"]');
        assert.hasClass($selectedStatus, 'btn-primary');
        assert.hasClass($selectedStatus,'disabled');
        var selector = '.o_statusbar_status button.btn-secondary:not(.dropdown-toggle):not(:disabled)';
        assert.containsN(form, selector, 2, "other status should be btn-secondary and not disabled");

        testUtils.dom.click(form.$('.o_statusbar_status .dropdown-toggle'));
        testUtils.dom.clickFirst(form.$(selector));

        var $status = form.$('.o_statusbar_status button[data-value="1"]');
        assert.hasClass($status, 'btn-primary');
        assert.hasClass($status, 'disabled');

        form.destroy();
    });
});
});
});
