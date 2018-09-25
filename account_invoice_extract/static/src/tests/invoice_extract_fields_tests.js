odoo.define('account_invoice_extract.FieldsTests', function (require) {
"use strict";

var InvoiceExtractFields = require('account_invoice_extract.Fields');

var testUtils = require('web.test_utils');

QUnit.module('account_invoice_extract', {}, function () {
QUnit.module('Fields', {}, function () {

    QUnit.test('render buttons', function (assert) {
        assert.expect(8);
        var parent = testUtils.createParent({});
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });

        var $buttons = $('.o_invoice_extract_button');
        assert.strictEqual($buttons.length, 7,
            "should display 7 field buttons");
        // check each button label
        assert.strictEqual($buttons.eq(0).text().trim(),
            'VAT',
            "1st button should have correct text");
        assert.strictEqual($buttons.eq(1).text().trim(),
            'Vendor',
            "2nd button should have correct text");
        assert.strictEqual($buttons.eq(2).text().trim(),
            'Currency',
            "3rd button should have correct text");
        assert.strictEqual($buttons.eq(3).text().trim(),
            'Total',
            "4th button should have correct text");
        assert.strictEqual($buttons.eq(4).text().trim(),
            'Date',
            "5th button should have correct text");
        assert.strictEqual($buttons.eq(5).text().trim(),
            'Due Date',
            "6th button should have correct text");
        assert.strictEqual($buttons.eq(6).text().trim(),
            'Vendor Reference',
            "7th button should have correct text");

        parent.destroy();
    });

    QUnit.test('get button', function (assert) {
        assert.expect(7);
        var parent = testUtils.createParent({});
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });

        var $buttons = $('.o_invoice_extract_button');
        assert.ok($buttons.eq(0).hasClass('active'), "1st button should be active by default");
        assert.notOk($buttons.eq(1).hasClass('active'), "2nd button should be inactive by default");
        assert.notOk($buttons.eq(2).hasClass('active'), "3rd button should be inactive by default");
        assert.notOk($buttons.eq(3).hasClass('active'), "4th button should be inactive by default");
        assert.notOk($buttons.eq(4).hasClass('active'), "5th button should be inactive by default");
        assert.notOk($buttons.eq(5).hasClass('active'), "6th button should be inactive by default");
        assert.notOk($buttons.eq(6).hasClass('active'), "7th button should be inactive by default");

        parent.destroy();
    });

    QUnit.test('get active field', function (assert) {
        assert.expect(1);
        var parent = testUtils.createParent({});
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });

        var activeField = fields.getActiveField();
        assert.strictEqual(activeField.getName(), 'VAT_Number',
            "should have correct active field");

        parent.destroy();
    });

    QUnit.test('get field (provided name)', function (assert) {
        assert.expect(1);
        var parent = testUtils.createParent({});
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });

        var field = fields.getField({ name: 'VAT_Number' });
        assert.strictEqual(field.getName(), 'VAT_Number',
            "should get the correct field");

        parent.destroy();
    });

    QUnit.test('get field (no provide name)', function (assert) {
        assert.expect(1);
        var parent = testUtils.createParent({});
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });
        assert.strictEqual(fields.getField(), fields.getActiveField(),
            "should get the active field when no field name is provided");

        parent.destroy();
    });

    QUnit.test('click field button', function (assert) {
        assert.expect(10);
        var parent = testUtils.createParent({
            intercepts: {
                active_invoice_extract_field: function (ev) {
                    ev.stopPropagation();
                    assert.step('new active field: ' + ev.data.fieldName);
                },
            },
        });
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });

        var vatField = fields.getField({ name: 'VAT_Number' });
        var totalField = fields.getField({ name: 'total' });
        var $vatButton = $('.o_invoice_extract_button[data-field-name="VAT_Number"]');
        var $totalButton = $('.o_invoice_extract_button[data-field-name="total"]');
        // check fields
        assert.ok(vatField.isActive(),
            "VAT field should be active by default");
        assert.notOk(totalField.isActive(),
            "Total field should be inactive by default");
        // check buttons
        assert.ok($vatButton.hasClass('active'),
            "field button 'VAT' should be active by default");
        assert.notOk($totalButton.hasClass('active'),
            "field button 'total' should be inactive by default");

        $totalButton.click();
        assert.verifySteps(['new active field: total']);

        // check fields
        assert.notOk(vatField.isActive(),
            "VAT field should become inactive");
        assert.ok(totalField.isActive(),
            "Total field should become active");
        // check buttons
        assert.notOk($vatButton.hasClass('active'),
            "field button 'VAT' should become inactive");
        assert.ok($totalButton.hasClass('active'),
            "field button 'total' should become active");

        parent.destroy();
    });

    QUnit.test('reset active', function (assert) {
        assert.expect(6);
        var parent = testUtils.createParent({
            intercepts: {
                active_invoice_extract_field: function (ev) {
                    ev.stopPropagation();
                },
            },
        });
        var fields = new InvoiceExtractFields(parent);

        fields.renderButtons({ $container: $('#qunit-fixture') });

        var $vatButton = $('.o_invoice_extract_button[data-field-name="VAT_Number"]');
        var $totalButton = $('.o_invoice_extract_button[data-field-name="total"]');

        assert.ok($vatButton.hasClass('active'),
            "field button 'VAT' should be active by default");
        assert.notOk($totalButton.hasClass('active'),
            "field button 'total' should be inactive by default");

        $totalButton.click();
        assert.notOk($vatButton.hasClass('active'),
            "field button 'VAT' should become inactive");
        assert.ok($totalButton.hasClass('active'),
            "field button 'total' should become active");

        fields.resetActive();
        assert.ok($vatButton.hasClass('active'),
            "field button 'VAT' should become active after resetting active field");
        assert.notOk($totalButton.hasClass('active'),
            "field button 'total' should become inactive after resetting active field");

        parent.destroy();
    });

});
});
});
