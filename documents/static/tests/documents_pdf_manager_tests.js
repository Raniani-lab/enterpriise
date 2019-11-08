odoo.define('documents.documents_pdf_manager_tests', function (require) {
'use strict';

const PdfManager = require('documents.component.PdfManager');
const testUtils = require('web.test_utils');

QUnit.module('DocumentsPdfManager', {
    beforeEach() {
        this.ORIGINAL_GET_PDF = PdfManager.prototype._getPdf;
        this.ORIGINAL_RENDER_CANVAS = PdfManager.prototype._renderCanvas;
        this.ORIGINAL_LOAD_ASSETS = PdfManager.prototype._loadAssets;
        PdfManager.prototype._loadAssets = async () => {};
        PdfManager.prototype._getPdf = async () => {
            return {
                getPage: number => {
                    return { number };
                },
                numPages: 6,
            };
        };
        PdfManager.prototype._renderCanvas = async (page, { width, height }) => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            return canvas;
        };
    },
    afterEach() {
        PdfManager.prototype._loadAssets = this.ORIGINAL_LOAD_ASSETS;
        PdfManager.prototype._getPdf = this.ORIGINAL_GET_PDF;
        PdfManager.prototype._renderCanvas = this.ORIGINAL_RENDER_CANVAS;
    },
}, () => {
    QUnit.test('Pdf Manager basic rendering', async function (assert) {
        assert.expect(9);

        const pdfManager = new PdfManager(null, {
            documents: [
                { id: 1, name: 'yop', mimetype: 'application/pdf', available_rule_ids: [1, 2] },
                { id: 2, name: 'blip', mimetype: 'application/pdf', available_rule_ids: [1] },
            ],
            rules: [
                { id: 1, display_name: 'rule1', note: 'note1', limited_to_single_record: false },
                { id: 2, display_name: 'rule2', limited_to_single_record: false },
            ],
            processDocuments: ({ documentIds, ruleId, exit } = {}) => {},
        });
        await pdfManager.mount($('#qunit-fixture')[0]);
        await testUtils.nextTick();

        assert.containsOnce($(pdfManager.el), '.o_documents_pdf_manager_top_bar',
            "There should be one top bar");
        assert.containsOnce($(pdfManager.el), '.o_documents_pdf_page_viewer',
            "There should be one page viewer");

        assert.containsOnce($(pdfManager.el), '.o_pdf_manager_button:contains(Split)',
            "There should be one Split button");
        assert.containsOnce($(pdfManager.el), '.o_pdf_manager_button:contains(Add File)',
            "There should be one Add File button");
        assert.containsN($(pdfManager.el), '.o_pdf_rule_buttons', 2,
            "There should be 2 rule buttons");

        assert.containsOnce($(pdfManager.el), '.o_pdf_separator_activated',
            "There should be one active separator");
        assert.containsN($(pdfManager.el), '.o_pdf_page', 12,
            "There should be 12 pages");
        assert.containsN($(pdfManager.el), '.o_documents_pdf_button_wrapper', 12,
            "There should be 12 button wrappers");

        assert.containsN($(pdfManager.el), '.o_pdf_group_name_wrapper', 2,
            "There should be 2 name plates");

        pdfManager.destroy();
    });

    QUnit.test('Pdf Manager: page interactions', async function (assert) {
        assert.expect(3);

        const pdfManager = new PdfManager(null, {
            documents: [
                { id: 1, name: 'yop', mimetype: 'application/pdf', available_rule_ids: [1, 2] },
                { id: 2, name: 'blip', mimetype: 'application/pdf', available_rule_ids: [1] },
            ],
            rules: [],
            processDocuments: ({ documentIds, ruleId, exit } = {}) => {},
        });
        await pdfManager.mount($('body')[0]);
        await testUtils.nextTick();

        assert.containsOnce($(pdfManager.el), '.o_pdf_separator_activated',
            "There should be one active separator");

        await testUtils.dom.click($(pdfManager.el).find('.o_page_splitter_wrapper:nth(1)'));
        await testUtils.nextTick();

        assert.containsN($(pdfManager.el), '.o_pdf_separator_activated', 2,
            "There should be 2 active separator");

        $(pdfManager.el).find('.o_documents_pdf_page_button:nth(3)').click();
        await testUtils.nextTick();
        assert.containsOnce($(pdfManager.el).find('.o_pdf_page:nth(3)'), '.o_pdf_canvas_page_icon',
            "There should be one ignored page");

        pdfManager.destroy();
    });

    QUnit.test('Pdf Manager: drag & drop', async function (assert) {
        assert.expect(4);

        const pdfManager = new PdfManager(null, {
            documents: [
                { id: 1, name: 'yop', mimetype: 'application/pdf', available_rule_ids: [1, 2] },
            ],
            rules: [],
            processDocuments: ({ documentIds, ruleId, exit } = {}) => {},
        });
        await pdfManager.mount($('body')[0]);
        await testUtils.nextTick();

        assert.containsN($(pdfManager.el), '.o_pdf_separator_activated', 5,
            "There should be 5 active separator");
        assert.containsOnce($(pdfManager.el).find('.o_documents_pdf_page_frame:nth(2)'), '.o_pdf_name_display',
            "The third page should have a name plate");

        const startEvent = new Event('dragstart', { bubbles: true, });
        const dataTransfer = new DataTransfer();
        startEvent.dataTransfer = dataTransfer;
        $(pdfManager.el).find('.o_documents_pdf_canvas_wrapper:nth(5)')[0].dispatchEvent(startEvent);

        const endEvent = new Event('drop', { bubbles: true, });
        endEvent.dataTransfer = dataTransfer;
        $(pdfManager.el).find('.o_documents_pdf_canvas_wrapper:nth(1)')[0].dispatchEvent(endEvent);

        await testUtils.nextTick();

        assert.containsN($(pdfManager.el), '.o_pdf_separator_activated', 4,
            "There should be 4 active separator");
        assert.containsNone($(pdfManager.el).find('.o_documents_pdf_page_frame:nth(2)'), '.o_pdf_name_display',
            "The third page shouldn't have a name plate");

        pdfManager.destroy();
    });
});

});
