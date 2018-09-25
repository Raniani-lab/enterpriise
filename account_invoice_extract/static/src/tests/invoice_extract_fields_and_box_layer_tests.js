odoo.define('account_invoice_extract.FieldsAndBoxLayerTests', function (require) {
"use strict";

/**
 * This test suite tests the integration of box layers with fields (including
 * field buttons), without relying on a form view.
 */
var InvoiceExtractFields = require('account_invoice_extract.Fields');
var invoiceExtractTestUtils = require('account_invoice_extract.testUtils');

var testUtils = require('web.test_utils');

/**
 * @param {Object} params
 * @param {Object} [params.intercepts={}]
 * @param {Object} params.invoiceExtractWrapper object to pass fields and box
 *   layer by reference. This is due to fields and box layer needing an
 *   instance of the parent object in order to be instantiated.
 * @param {account_invoice_extract.Fields|undefined} params.invoiceExtractWrapper.fields
 *   this is set after the parent is created, but it should be used when this
 *   is set.
 * @param {account_invoice_extract.BoxLayer|undefined} params.invoiceExtractWrapper.boxLayer
 *   this is set after the parent is created, but it should be used when this
 *   is set.
 */
function createParent(params) {
    var invoiceExtractWrapper = params.invoiceExtractWrapper;
    params.intercepts = _.extend({}, params.intercepts, {
        /**
         * Triggered when there is a change of active field
         *
         * @param {OdooEvent} ev
         */
        active_invoice_extract_field: function (ev) {
            ev.stopPropagation();
            var fieldName = invoiceExtractWrapper.fields.getActiveField().getName();
            invoiceExtractWrapper.boxLayer.displayBoxes({ fieldName: fieldName });
        },
        /**
         * Triggered by OCR chosen box
         *
         * @param {OdooEvent} ev
         * @param {account_invoice_extract.Box} ev.data.box
         */
        choice_ocr_invoice_extract_box: function (ev) {
            ev.stopPropagation();
            var box = ev.data.box;
            var field = invoiceExtractWrapper.fields.getField({
                name: box.getFieldName()
            });
            field.setOcrChosenBox(box);
        },
        /**
         * Triggered when clicking on a box
         *
         * @param {OdooEvent} ev
         * @param {account_invoice_extract.Box} ev.data.box
         */
        click_invoice_extract_box: function (ev) {
            ev.stopPropagation();
            var box = ev.data.box;
            var field = invoiceExtractWrapper.fields.getField({
                name: box.getFieldName()
            });
            field.setSelectedBox(box);
        },
        /**
         * Triggered when clicking on a box layer
         *
         * @param {OdooEvent} ev
         */
        click_invoice_extract_box_layer: function (ev) {
            ev.stopPropagation();
            var field = invoiceExtractWrapper.fields.getActiveField();
            var box = field.getSelectedBox();
            if (!box) {
                return;
            }
            field.unselectBox();
        },
        /**
         * Triggered by user selected box
         *
         * @param {OdooEvent} ev
         * @param {account_invoice_extract.Box} ev.data.box
         */
        select_invoice_extract_box: function (ev) {
            ev.stopPropagation();
            var box = ev.data.box;
            var field = invoiceExtractWrapper.fields.getField({
                name: box.getFieldName()
            });
            field.setSelectedBox(box);
        },
    });
    var parent = testUtils.createParent(params);
    return parent;
}

/**
 * @param {Object} [params={}]
 * @param {boolean} [params.debug=false]
 * @returns {Object}
 */
function createFieldsAndBoxLayer(params) {
    params = params || {};
    var $container = params.debug ? $('body') : $('#qunit-fixture');

    // use wrapper to pass fields and box layer by reference
    // (due to them not already instantiated)
    var wrapper = {};
    var parent = createParent({
        invoiceExtractWrapper: wrapper,
        debug: params.debug || false,
    });

    var fields = wrapper.fields = new InvoiceExtractFields(parent);
    fields.renderButtons({ $container: $container });
    var res = invoiceExtractTestUtils.createBoxLayer({ parent: parent });
    var boxLayer = wrapper.boxLayer = res.boxLayer;
    boxLayer.displayBoxes({ fieldName: fields.getActiveField().getName() });

    return {
        boxLayer: boxLayer,
        fields: fields,
        parent: parent,
    };
}

QUnit.module('account_invoice_extract', {}, function () {
QUnit.module('Fields & BoxLayer integration', {}, function () {

    QUnit.test('basic', function (assert) {
        assert.expect(29);

        var res = createFieldsAndBoxLayer();
        var fields = res.fields;
        var parent = res.parent;

        assert.strictEqual(fields.getActiveField().getName(), 'VAT_Number',
            "by default, VAT should be the default active field");
        assert.strictEqual($('.o_invoice_extract_button').length, 7,
            "should render all 7 fields buttons");

        // box 1
        assert.strictEqual($('.o_invoice_extract_box[data-id=1]').length, 1,
            "should have box with ID 1");
        assert.strictEqual($('.o_invoice_extract_box[data-id=1]').data('field-name'),
            'VAT_Number',
            "should have correct field name for box with ID 1");
        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('ocr_chosen'),
            "should not set box with ID 1 as OCR chosen");
        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "should not set box with ID 1 as selected");
        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('o_hidden'),
            "should show box with ID 1 by default");
        // box 2
        assert.strictEqual($('.o_invoice_extract_box[data-id=2]').length, 1,
            "should have box with ID 1");
        assert.strictEqual($('.o_invoice_extract_box[data-id=2]').data('field-name'),
            'VAT_Number',
            "should have correct field name for box with ID 2");
        assert.ok($('.o_invoice_extract_box[data-id=2]').hasClass('ocr_chosen'),
            "should set box with ID 2 as OCR chosen");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "should not set box with ID 2 as selected");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('o_hidden'),
            "should show box with ID 2 by default");
        // box 3
        assert.strictEqual($('.o_invoice_extract_box[data-id=3]').length, 1,
            "should have box with ID 3");
        assert.strictEqual($('.o_invoice_extract_box[data-id=3]').data('field-name'),
            'VAT_Number',
            "should have correct field name for box with ID 3");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('ocr_chosen'),
            "should not set box with ID 3 as OCR chosen");
        assert.ok($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "should set box with ID 3 as selected");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('o_hidden'),
            "should show box with ID 3 by default");
        // box 4
        assert.strictEqual($('.o_invoice_extract_box[data-id=4]').length, 1,
            "should have box with ID 4");
        assert.strictEqual($('.o_invoice_extract_box[data-id=4]').data('field-name'),
            'total',
            "should have correct field name for box with ID 4");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('ocr_chosen'),
            "should not set box with ID 4 as OCR chosen");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "should not set box with ID 4 as selected");
        assert.ok($('.o_invoice_extract_box[data-id=4]').hasClass('o_hidden'),
            "should hide box with ID 4 by default");
        // box 5
        assert.strictEqual($('.o_invoice_extract_box[data-id=5]').length, 1,
            "should have box with ID 5");
        assert.strictEqual($('.o_invoice_extract_box[data-id=5]').data('field-name'),
            'total',
            "should have correct field name for box with ID 5");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('ocr_chosen'),
            "should set box with ID 5 as OCR chosen");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "should set box with ID 5 as selected");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('o_hidden'),
            "should hide box with ID 5 by default");

        var vatField = fields.getField({ name: 'VAT_Number' });
        var totalField = fields.getField({ name: 'total' });

        assert.strictEqual(vatField.getSelectedBox().getID(), 3,
            "should have correctly registered the selected box for 'VAT_Number'");
        assert.strictEqual(totalField.getSelectedBox().getID(), 5,
            "should have correctly registered the selected box for 'total'");

        parent.destroy();
    });

    QUnit.test('click on field button', function (assert) {
        assert.expect(11);

        var res = createFieldsAndBoxLayer({ debug: true });
        var fields = res.fields;
        var parent = res.parent;

        assert.strictEqual(fields.getActiveField().getName(), 'VAT_Number',
            "by default, VAT should be the default active field");

        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('o_hidden'),
            "should show box with ID 1 by default");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('o_hidden'),
            "should show box with ID 2 by default");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('o_hidden'),
            "should show box with ID 3 by default");
        assert.ok($('.o_invoice_extract_box[data-id=4]').hasClass('o_hidden'),
            "should hide box with ID 4 by default");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('o_hidden'),
            "should hide box with ID 5 by default");

        $('.o_invoice_extract_button[data-field-name="total"]').click();

        assert.ok($('.o_invoice_extract_box[data-id=1]').hasClass('o_hidden'),
            "box with ID 1 should become hidden");
        assert.ok($('.o_invoice_extract_box[data-id=2]').hasClass('o_hidden'),
            "box with ID 2 should become hidden");
        assert.ok($('.o_invoice_extract_box[data-id=3]').hasClass('o_hidden'),
            "box with ID 3 should become hidden");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('o_hidden'),
            "box with ID 4 should become visible");
        assert.notOk($('.o_invoice_extract_box[data-id=5]').hasClass('o_hidden'),
            "box with ID 5 should become visible");

        parent.destroy();
    });

    QUnit.test('select another box', function (assert) {
        assert.expect(16);

        var res = createFieldsAndBoxLayer();
        var fields = res.fields;
        var parent = res.parent;

        assert.strictEqual(fields.getActiveField().getName(), 'VAT_Number',
            "by default, VAT should be the default active field");

        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "box with ID 1 should not be selected");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "box with ID 2 should not be selected");
        assert.ok($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "box with ID 3 should be selected");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "box with ID 4 should not be selected");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "box with ID 5 should be selected");

        $('.o_invoice_extract_box[data-id=1]').click();

        assert.ok($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "box with ID 1 should become selected");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "box with ID 2 should stay unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "box with ID 3 should become unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "box with ID 4 should stay unselected");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "box with ID 5 should stay selected");

        $('.o_invoice_extract_button[data-field-name="total"]').click();
        $('.o_invoice_extract_box[data-id=4]').click();

        assert.ok($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "box with ID 1 should stay selected");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "box with ID 2 should stay unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "box with ID 3 should stay unselected");
        assert.ok($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "box with ID 4 should become selected");
        assert.notOk($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "box with ID 5 should become unselected");

        parent.destroy();
    });

    QUnit.test('click on box layer', function (assert) {
        assert.expect(16);

        var res = createFieldsAndBoxLayer();
        var fields = res.fields;
        var parent = res.parent;

        assert.strictEqual(fields.getActiveField().getName(), 'VAT_Number',
            "by default, VAT should be the default active field");

        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "box with ID 1 should not be selected");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "box with ID 2 should not be selected");
        assert.ok($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "box with ID 3 should be selected");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "box with ID 4 should not be selected");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "box with ID 5 should be selected");

        $('.boxLayer').click();

        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "box with ID 1 should stay unselected");
        assert.ok($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "box with ID 2 should become selected (fallback on OCR chosen)");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "box with ID 3 should become unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "box with ID 4 should stay unselected");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "box with ID 5 should stay selected");

        $('.boxLayer').click();

        assert.notOk($('.o_invoice_extract_box[data-id=1]').hasClass('selected'),
            "box with ID 1 should not stay unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=2]').hasClass('selected'),
            "box with ID 2 should become unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=3]').hasClass('selected'),
            "box with ID 3 should stay unselected");
        assert.notOk($('.o_invoice_extract_box[data-id=4]').hasClass('selected'),
            "box with ID 4 should stay unselected");
        assert.ok($('.o_invoice_extract_box[data-id=5]').hasClass('selected'),
            "box with ID 5 should stay selected");

        parent.destroy();
    });

});
});
});
