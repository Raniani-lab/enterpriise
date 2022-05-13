/** @odoo-module **/

import {
    afterNextRender,
    nextAnimationFrame,
    start,
    startServer,
} from '@mail/../tests/helpers/test_utils';

import FormRenderer from '@account_invoice_extract/js/invoice_extract_form_renderer';
import FormView from '@account_invoice_extract/js/invoice_extract_form_view';
import invoiceExtractTestUtils from '@account_invoice_extract/tests/helpers/invoice_extract_test_utils';

import config from 'web.config';
import testUtils from 'web.test_utils';

QUnit.module('account_invoice_extract', {}, function () {
QUnit.module('invoice_extract_form_view_tests.js', {
    beforeEach() {
        testUtils.mock.patch(FormRenderer, {
            /**
             * Called when chatter is rendered
             *
             * @param {OdooEvent} ev
             */
            _onAttachmentPreviewValidation: function (ev) {
                ev.stopPropagation();
                var $attachment = this.$attachmentPreview.find('.img-fluid');
                this._startInvoiceExtract($attachment);
            },
        });
    },
    afterEach: function () {
        testUtils.mock.unpatch(FormRenderer);
    },
}, function () {

    QUnit.test('basic', async function (assert) {
        assert.expect(27);

        const pyEnv = await startServer();
        const resCurrencyId1 = pyEnv['res.currency'].create({ name: 'USD' });
        const accountMoveId1 = pyEnv['account.move'].create({
            amount_total: 100,
            currency_id: resCurrencyId1,
            date: '1984-12-15',
            invoice_date_due: '1984-12-20',
            display_name: 'MyInvoice',
            invoice_date: '1984-12-15',
        });
        const irAttachmentId1 = pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            res_model: 'account.move',
            res_id: accountMoveId1,
        });
        pyEnv['mail.message'].create({
            attachment_ids: [irAttachmentId1],
            model: 'account.move',
            res_id: accountMoveId1,
        });
        const { target: form } = await start({
            hasView: true,
            View: FormView,
            model: 'account.move',
            arch: '<form string="Account Invoice">' +
                    '<div class="o_success_ocr"/>' +
                    '<div class="o_attachment_preview" options="{\'order\':\'desc\'}"></div>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
            // FIXME could be removed once task-2248306 is done
            archs: {
                'mail.message,false,list': '<tree/>',
            },
            res_id: accountMoveId1,
            services: this.services,
            config: {
                device: {
                    size_class: config.device.SIZES.XXL,
                },
            },
            mockRPC(route, args) {
                if (args.method === 'get_boxes') {
                    return Promise.resolve(invoiceExtractTestUtils.createBoxesData());
                } else if (args.method === 'register_as_main_attachment') {
                    return Promise.resolve(true);
                }
                return this._super.apply(this, arguments);
            },
            waitUntilEvent: {
                eventName: 'o-thread-view-hint-processed',
                message: "should wait until account.move 2 thread displayed its messages",
                predicate: ({ hint, threadViewer }) => {
                    return (
                        hint.type === 'messages-loaded' &&
                        threadViewer.thread.model === 'account.move' &&
                        threadViewer.thread.id === accountMoveId1
                    );
                },
            },
        });

        // Need to load form view before going to edit mode, otherwise
        // 'o_success_ocr' is not loaded.
        await afterNextRender(() => testUtils.dom.click($('.o_form_button_edit')));

        let attachmentPreview = form.querySelectorAll('.o_attachment_preview_img');

        // check presence of attachment, buttons, box layer, boxes
        assert.strictEqual(attachmentPreview.length, 1,
            "should display attachment preview");
        assert.containsOnce(attachmentPreview[0], '.o_invoice_extract_buttons',
            "should display the field extract buttons on attachment preview");
        assert.strictEqual($('.o_invoice_extract_button').length, 5,
            "should display 5 invoice extract buttons");
        assert.strictEqual($('.o_invoice_extract_button.active').length, 1,
            "should have one field extract button that is active");
        assert.strictEqual($('.o_invoice_extract_button.active').data('field-name'),
            'VAT_Number',
            "should have 'VAT_Number' as the active field");
        assert.strictEqual(attachmentPreview[0].querySelectorAll('.boxLayer').length, 1,
            "should contain a box layer on attachment");
        assert.containsN(attachmentPreview[0], '.o_invoice_extract_box', 5,
            "should contain all boxes");

        // check field name of boxes
        assert.strictEqual(form.querySelector('.o_invoice_extract_box[data-id="1"]').getAttribute('data-field-name'),
            'VAT_Number',
            "box with ID 1 should be related to field 'VAT_Number'");
        assert.strictEqual(form.querySelector('.o_invoice_extract_box[data-id="2"]').getAttribute('data-field-name'),
            'VAT_Number',
            "box with ID 2 should be related to field 'VAT_Number'");
        assert.strictEqual(form.querySelector('.o_invoice_extract_box[data-id="3"]').getAttribute('data-field-name'),
            'VAT_Number',
            "box with ID 3 should be related to field 'VAT_Number'");
        assert.strictEqual(form.querySelector('.o_invoice_extract_box[data-id="4"]').getAttribute('data-field-name'),
            'invoice_id',
            "box with ID 4 should be related to field 'invoice_id'");
        assert.strictEqual(form.querySelector('.o_invoice_extract_box[data-id="5"]').getAttribute('data-field-name'),
            'invoice_id',
            "box with ID 5 should be related to field 'invoice_id'");

        // check visibility of boxes
        // the box is appended in the o_attachment_preview, which is displayed
        // on XXL screens thanks to mediaqueries ; however, the test suite is
        // executed on a 1366x768 screen, so the rule doesn't apply and the
        // boxes are actually not visible ; for that reason, we don't use the
        // is(Not)Visible helpers, but directly check the presence/absence of
        // class o_hidden
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="1"]').classList.contains('o_hidden'),
            "box with ID 1 should be visible");
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="2"]').classList.contains('o_hidden'),
            "box with ID 2 should be visible");
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="3"]').classList.contains('o_hidden'),
            "box with ID 3 should be visible");
        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="4"]').classList.contains('o_hidden'),
            "box with ID 4 should be invisible");
        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="5"]').classList.contains('o_hidden'),
            "box with ID 5 should be invisible");

        // check selection of boxes
        assert.doesNotHaveClass(form.querySelector('.o_invoice_extract_box[data-id="1"]'), 'ocr_chosen',
            "box with ID 1 should not be OCR chosen");
        assert.doesNotHaveClass(form.querySelector('.o_invoice_extract_box[data-id="1"]'), 'selected',
            "box with ID 1 should not be selected");
        assert.hasClass(form.querySelector('.o_invoice_extract_box[data-id="2"]'),'ocr_chosen',
            "box with ID 2 should be OCR chosen");
        assert.doesNotHaveClass(form.querySelector('.o_invoice_extract_box[data-id="2"]'), 'selected',
            "box with ID 2 should not be selected");
        assert.doesNotHaveClass(form.querySelector('.o_invoice_extract_box[data-id="3"]'), 'ocr_chosen',
            "box with ID 3 should not be OCR chosen");
        assert.hasClass(form.querySelector('.o_invoice_extract_box[data-id="3"]'),'selected',
            "box with ID 3 should be selected");
        assert.doesNotHaveClass(form.querySelector('.o_invoice_extract_box[data-id="4"]'), 'ocr_chosen',
            "box with ID 4 should not be OCR chosen");
        assert.doesNotHaveClass(form.querySelector('.o_invoice_extract_box[data-id="4"]'), 'selected',
            "box with ID 4 should not be selected");
        assert.hasClass(form.querySelector('.o_invoice_extract_box[data-id="5"]'),'ocr_chosen',
            "box with ID 5 should be OCR chosen");
        assert.hasClass(form.querySelector('.o_invoice_extract_box[data-id="5"]'),'selected',
            "box with ID 5 should be selected");
    });

    QUnit.test('no box and button in readonly mode', async function (assert) {
        assert.expect(15);

        const pyEnv = await startServer();
        const resCurrencyId1 = pyEnv['res.currency'].create({ name: 'USD' });
        const accountMoveId1 = pyEnv['account.move'].create({
            amount_total: 100,
            currency_id: resCurrencyId1,
            date: '1984-12-15',
            invoice_date_due: '1984-12-20',
            display_name: 'MyInvoice',
            invoice_date: '1984-12-15',
        });
        const irAttachmentId1 = pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            res_model: 'account.move',
            res_id: accountMoveId1,
        });
        pyEnv['mail.message'].create({
            attachment_ids: [irAttachmentId1],
            model: 'account.move',
            res_id: accountMoveId1,
        });
        const { target: form } = await start({
            hasView: true,
            View: FormView,
            model: 'account.move',
            arch: '<form string="Account Invoice">' +
                    '<div class="o_success_ocr"/>' +
                    '<div class="o_attachment_preview" options="{\'order\':\'desc\'}"></div>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
            // FIXME could be removed once task-2248306 is done
            archs: {
                'mail.message,false,list': '<tree/>',
            },
            res_id: accountMoveId1,
            config: {
                device: {
                    size_class: config.device.SIZES.XXL,
                },
            },
            mockRPC(route, args) {
                if (args.method === 'get_boxes') {
                    return Promise.resolve(invoiceExtractTestUtils.createBoxesData());
                } else if (args.method === 'register_as_main_attachment') {
                    return Promise.resolve(true);
                }
                return this._super.apply(this, arguments);
            },
            waitUntilEvent: {
                eventName: 'o-thread-view-hint-processed',
                message: "should wait until account.move 2 thread displayed its messages",
                predicate: ({ hint, threadViewer }) => {
                    return (
                        hint.type === 'messages-loaded' &&
                        threadViewer.thread.model === 'account.move' &&
                        threadViewer.thread.id === accountMoveId1
                    );
                },
            },
        });

        await nextAnimationFrame();

        let attachmentPreview = form.querySelectorAll('.o_attachment_preview_img');
        assert.strictEqual(attachmentPreview.length, 1,
            "should display attachment preview");
        assert.strictEqual(attachmentPreview[0].querySelectorAll('.o_invoice_extract_buttons').length, 0,
            "should not display any field extract buttons on attachment preview in readonly mode");
        assert.strictEqual($('.o_invoice_extract_button').length, 0,
            "should not display any invoice extract buttons in readonly mode");
        assert.strictEqual($('.boxLayer').length, 0,
            "should not display any box layer in readonly mode");
        assert.strictEqual($('.o_invoice_extract_box').length, 0,
            "should not display any box in readonly mode");

        // Need to load form view before going to edit mode, otherwise
        // 'o_success_ocr' is not loaded.
        await afterNextRender(() => {
            testUtils.dom.click($('.o_form_button_edit'));
        });

        attachmentPreview = form.querySelectorAll('.o_attachment_preview_img');
        assert.strictEqual(attachmentPreview.length, 1,
            "should still display an attachment preview in edit mode");
        assert.strictEqual(attachmentPreview[0].querySelectorAll('.o_invoice_extract_buttons').length, 1,
            "should now display field extract buttons on attachment preview in edit mode");
        assert.strictEqual($('.o_invoice_extract_button').length, 5,
            "should now display 5 invoice extract buttons in edit mode");
        assert.strictEqual($('.boxLayer').length, 1,
            "should now display box layer in edit mode");
        assert.strictEqual($('.o_invoice_extract_box').length, 5,
            "should now display boxes in edit mode");

        await afterNextRender(() => {
            testUtils.dom.click($('.o_form_button_save'));
        });

        attachmentPreview = form.querySelectorAll('.o_attachment_preview_img');
        assert.strictEqual(attachmentPreview.length, 1,
            "should still display attachment preview in readonly mode");
        assert.strictEqual(attachmentPreview[0].querySelectorAll('.o_invoice_extract_buttons').length, 0,
            "should no longer display field extract buttons on attachment preview in readonly mode");
        assert.strictEqual($('.o_invoice_extract_button').length, 0,
            "should no longer display invoice extract buttons in readonly mode");
        assert.strictEqual($('.boxLayer').length, 0,
            "should no longer display box layer in readonly mode");
        assert.strictEqual($('.o_invoice_extract_box').length, 0,
            "should no longer display boxes in readonly mode");
    });

    QUnit.test('change active field', async function (assert) {
        assert.expect(12);

        const pyEnv = await startServer();
        const resCurrencyId1 = pyEnv['res.currency'].create({ name: 'USD' });
        const accountMoveId1 = pyEnv['account.move'].create({
            amount_total: 100,
            currency_id: resCurrencyId1,
            date: '1984-12-15',
            invoice_date_due: '1984-12-20',
            display_name: 'MyInvoice',
            invoice_date: '1984-12-15',
        });
        const irAttachmentId1 = pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            res_model: 'account.move',
            res_id: accountMoveId1,
        });
        pyEnv['mail.message'].create({
            attachment_ids: [irAttachmentId1],
            model: 'account.move',
            res_id: accountMoveId1,
        });
        const { click, target: form } = await start({
            hasView: true,
            View: FormView,
            model: 'account.move',
            arch: '<form string="Account Invoice">' +
                    '<div class="o_success_ocr"/>' +
                    '<div class="o_attachment_preview" options="{\'order\':\'desc\'}"></div>' +
                    '<div class="oe_chatter">' +
                        '<field name="message_ids"/>' +
                    '</div>' +
                '</form>',
            // FIXME could be removed once task-2248306 is done
            archs: {
                'mail.message,false,list': '<tree/>',
            },
            res_id: accountMoveId1,
            config: {
                device: {
                    size_class: config.device.SIZES.XXL,
                },
            },
            mockRPC(route, args) {
                if (args.method === 'get_boxes') {
                    return Promise.resolve(invoiceExtractTestUtils.createBoxesData());
                } else if (args.method === 'register_as_main_attachment') {
                    return Promise.resolve(true);
                }
                return this._super.apply(this, arguments);
            },
            waitUntilEvent: {
                eventName: 'o-thread-view-hint-processed',
                message: "should wait until account.move 2 thread displayed its messages",
                predicate: ({ hint, threadViewer }) => {
                    return (
                        hint.type === 'messages-loaded' &&
                        threadViewer.thread.model === 'account.move' &&
                        threadViewer.thread.id === accountMoveId1
                    );
                },
            },
        });

        // Need to load form view before going to edit mode, otherwise
        // 'o_success_ocr' is not loaded.
        await click('.o_form_button_edit');

        assert.strictEqual($('.o_invoice_extract_button.active').data('field-name'),
            'VAT_Number', "should have 'VAT_Number' as the active field");

        // the box is appended in the o_attachment_preview, which is displayed
        // on XXL screens thanks to mediaqueries ; however, the test suite is
        // executed on a 1366x768 screen, so the rule doesn't apply and the
        // boxes are actually not visible ; for that reason, we don't use the
        // click and is(Not)Visible helpers
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="1"]').classList.contains('o_hidden'),
            "box with ID 1 should be visible");
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="2"]').classList.contains('o_hidden'),
            "box with ID 2 should be visible");
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="3"]').classList.contains('o_hidden'),
            "box with ID 3 should be visible");
        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="4"]').classList.contains('o_hidden'),
            "box with ID 4 should be invisible");
        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="5"]').classList.contains('o_hidden'),
            "box with ID 5 should be invisible");

        assert.containsOnce($('body'), '.o_invoice_extract_button[data-field-name="invoice_id"]');
        await testUtils.dom.click($('.o_invoice_extract_button[data-field-name="invoice_id"]'), {'allowInvisible': true});

        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="1"]').classList.contains('o_hidden'),
            "box with ID 1 should become invisible");
        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="2"]').classList.contains('o_hidden'),
            "box with ID 2 should become invisible");
        assert.ok(form.querySelector('.o_invoice_extract_box[data-id="3"]').classList.contains('o_hidden'),
            "box with ID 3 should become invisible");
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="4"]').classList.contains('o_hidden'),
            "box with ID 4 should become visible");
        assert.notOk(form.querySelector('.o_invoice_extract_box[data-id="5"]').classList.contains('o_hidden'),
            "box with ID 5 should become visible");
    });

    QUnit.test('always keep one box layer per page on enabling OCR boxes visualisation', async function (assert) {
        assert.expect(3);

        const pyEnv = await startServer();
        const resCurrencyId1 = pyEnv['res.currency'].create({ name: 'USD' });
        const accountMoveId1 = pyEnv['account.move'].create({
            amount_total: 100,
            currency_id: resCurrencyId1,
            date: '1984-12-15',
            invoice_date_due: '1984-12-20',
            display_name: 'MyInvoice',
            invoice_date: '1984-12-15',
        });
        const irAttachmentId1 = pyEnv['ir.attachment'].create({
            mimetype: 'image/jpeg',
            res_model: 'account.move',
            res_id: accountMoveId1,
        });
        pyEnv['mail.message'].create({
            attachment_ids: [irAttachmentId1],
            model: 'account.move',
            res_id: accountMoveId1,
        });
        const { target: form } = await start({
            hasView: true,
            View: FormView,
            model: 'account.move',
            arch: `<form string="Account Invoice">
                    <div class="o_success_ocr"/>
                    <div class="o_attachment_preview" options="{'order': 'desc'}"></div>
                    <div class="oe_chatter">
                        <field name="message_ids"/>
                    </div>
                </form>`,
            // FIXME could be removed once task-2248306 is done
            archs: {
                'mail.message,false,list': '<tree/>',
            },
            res_id: accountMoveId1,
            config: {
                device: {
                    size_class: config.device.SIZES.XXL,
                },
            },
            async mockRPC(route, args) {
                if (args.method === 'get_boxes') {
                    return invoiceExtractTestUtils.createBoxesData();
                } else if (args.method === 'register_as_main_attachment') {
                    return true;
                }
                return this._super(...arguments);
            },
            waitUntilEvent: {
                eventName: 'o-thread-view-hint-processed',
                message: "should wait until account.move 2 thread displayed its messages",
                predicate: ({ hint, threadViewer }) => {
                    return (
                        hint.type === 'messages-loaded' &&
                        threadViewer.thread.model === 'account.move' &&
                        threadViewer.thread.id === accountMoveId1
                    );
                },
            },
        });

        // Need to load form view before going to edit mode, otherwise
        // 'o_success_ocr' is not loaded.
        await afterNextRender(() => {
            testUtils.dom.click($('.o_form_button_edit'));
        });
        let attachmentPreview = form.querySelectorAll('.o_attachment_preview_img');
        // check presence of attachment, buttons, box layer, boxes
        assert.strictEqual(attachmentPreview.length, 1,
            "should display attachment preview");
        assert.strictEqual(attachmentPreview[0].querySelectorAll('.boxLayer').length, 1,
            "should contain a box layer on attachment");

        // Send a new message to trigger a rerender (which will trigger a new boxlayer creation)
        await afterNextRender(() => {
            testUtils.dom.click($('.o_ChatterTopbar_buttonLogNote'));
        });
        form.querySelector('.o_ComposerTextInput_textarea').value = "Blah";
        await testUtils.dom.click($('.o_Composer_buttonSend'));

        attachmentPreview = form.querySelectorAll('.o_attachment_preview_img');
        // check presence of attachment, buttons, box layer, boxes
        assert.strictEqual(attachmentPreview[0].querySelectorAll('.boxLayer').length, 1,
            "should contain only one box layer on attachment");
        // Need to wait a little while so that the attachmentPreview finished its rendering
        await testUtils.nextTick();
    });
});
});
