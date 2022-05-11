odoo.define('documents.mobile_tests', function (require) {
"use strict";

const DocumentsKanbanView = require('documents.DocumentsKanbanView');
const DocumentsListView = require('documents.DocumentsListView');
const { createDocumentsView } = require('documents.test_utils');

const { startServer } = require('@mail/../tests/helpers/test_utils');

const { dom, nextTick } = require('web.test_utils');

QUnit.module('documents', {}, function () {
QUnit.module('documents_kanban_mobile_tests.js', {}, function () {
    QUnit.module('DocumentsKanbanViewMobile', function () {

    QUnit.test('basic rendering on mobile', async function (assert) {
        assert.expect(12);

        const pyEnv = await startServer();
        pyEnv['documents.folder'].create({ name: 'Workspace1', description: '_F1-test-description_' });
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            arch: `
                <kanban>
                    <templates>
                        <t t-name="kanban-box">
                            <div>
                                <field name="name"/>
                            </div>
                        </t>
                    </templates>
                </kanban>
            `,
        });

        assert.containsOnce(kanban, '.o_documents_kanban_view',
            "should have a documents kanban view");
        assert.containsOnce(kanban, '.o_documents_inspector',
            "should have a documents inspector");

        const $controlPanelButtons = $('.o_control_panel .o_cp_buttons');
        assert.containsOnce($controlPanelButtons, '> .dropdown',
            "should group ControlPanel's buttons into a dropdown");
        assert.containsNone($controlPanelButtons, '> .btn',
            "there should be no button left in the ControlPanel's left part");

        // open search panel
        await dom.click(dom.find(document.body, '.o_search_panel_current_selection'));
        // select global view
        await dom.click(dom.find(document.body, '.o_search_panel_category_value:first-child header'));
        // close search panel
        await dom.click(dom.find(document.body, '.o_mobile_search_footer'));
        assert.ok(kanban.$buttons.find('.o_documents_kanban_upload').is(':disabled'),
            "the upload button should be disabled on global view");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_url').is(':disabled'),
            "the upload url button should be disabled on global view");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_request').is(':disabled'),
            "the request button should be disabled on global view");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_share_domain').is(':disabled'),
            "the share button should be disabled on global view");

        // open search panel
        await dom.click(dom.find(document.body, '.o_search_panel_current_selection'));
        // select first folder
        await dom.click(dom.find(document.body, '.o_search_panel_category_value:nth-child(2) header'));
        // close search panel
        await dom.click(dom.find(document.body, '.o_mobile_search_footer'));
        assert.ok(kanban.$buttons.find('.o_documents_kanban_upload').not(':disabled'),
            "the upload button should be enabled when a folder is selected");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_url').not(':disabled'),
            "the upload url button should be enabled when a folder is selected");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_request').not(':disabled'),
            "the request button should be enabled when a folder is selected");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_share_domain').not(':disabled'),
            "the share button should be enabled when a folder is selected");

        kanban.destroy();
    });

    QUnit.module('DocumentsInspector');

    QUnit.test('toggle inspector based on selection', async function (assert) {
        assert.expect(13);

        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv['documents.folder'].create({ name: 'Workspace1', description: '_F1-test-description_' });
        pyEnv['documents.document'].create([
            { folder_id: documentsFolderId1 },
            { folder_id: documentsFolderId1 },
        ]);
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            arch: `
                <kanban>
                    <templates>
                        <t t-name="kanban-box">
                            <div>
                                <i class="fa fa-circle-thin o_record_selector"/>
                                <field name="name"/>
                            </div>
                        </t>
                    </templates>
                </kanban>
            `,
        });

        assert.isNotVisible(kanban.$('.o_documents_mobile_inspector'),
            "inspector should be hidden when selection is empty");
        assert.containsN(kanban, '.o_kanban_record:not(.o_kanban_ghost)', 2,
            "should have 2 records in the renderer");

        // select a first record
        await dom.click(kanban.$('.o_kanban_record:first .o_record_selector'));
        await nextTick();
        assert.containsOnce(kanban, '.o_kanban_record.o_record_selected:not(.o_kanban_ghost)',
            "should have 1 record selected");
        const toggleInspectorSelector = '.o_documents_mobile_inspector > .o_documents_toggle_inspector';
        assert.isVisible(kanban.$(toggleInspectorSelector),
            "toggle inspector's button should be displayed when selection is not empty");
        assert.strictEqual(kanban.$(toggleInspectorSelector).text().replace(/\s+/g, " ").trim(), '1 document selected');

        await dom.click(kanban.$(toggleInspectorSelector));
        assert.isVisible(kanban.$('.o_documents_mobile_inspector'),
            "inspector should be opened");

        await dom.click(kanban.$('.o_documents_close_inspector'));
        assert.isNotVisible(kanban.$('.o_documents_mobile_inspector'),
            "inspector should be closed");

        // select a second record
        await dom.click(kanban.$('.o_kanban_record:eq(1) .o_record_selector'));
        await nextTick();
        assert.containsN(kanban, '.o_kanban_record.o_record_selected:not(.o_kanban_ghost)', 2,
            "should have 2 records selected");
        assert.strictEqual(kanban.$(toggleInspectorSelector).text().replace(/\s+/g, " ").trim(), '2 documents selected');

        // click on the record
        await dom.click(kanban.$('.o_kanban_record:first'));
        await nextTick();
        assert.containsOnce(kanban, '.o_kanban_record.o_record_selected:not(.o_kanban_ghost)',
            "should have 1 record selected");
        assert.strictEqual(kanban.$(toggleInspectorSelector).text().replace(/\s+/g, " ").trim(), '1 document selected');
        assert.isVisible(kanban.$('.o_documents_mobile_inspector'),
            "inspector should be opened");

        // close inspector
        await dom.click(kanban.$('.o_documents_close_inspector'));
        assert.containsOnce(kanban, '.o_kanban_record.o_record_selected:not(.o_kanban_ghost)',
            "should still have 1 record selected after closing inspector");
    });
    });

    QUnit.module('DocumentsListViewMobile', function () {

    QUnit.test('basic rendering on mobile', async function (assert) {
        assert.expect(12);

        const pyEnv = await startServer();
        pyEnv['documents.folder'].create({ name: 'Workspace1', description: '_F1-test-description_' });
        const list = await createDocumentsView({
            View: DocumentsListView,
            model: 'documents.document',
            arch: `
                <tree>
                    <field name="name"/>
                </tree>
            `,
        });

        assert.containsOnce(list, '.o_documents_list_view',
            "should have a documents list view");
        assert.containsOnce(list, '.o_documents_inspector',
            "should have a documents inspector");

        const $controlPanelButtons = $('.o_control_panel .o_cp_buttons');
        assert.containsOnce($controlPanelButtons, '> .dropdown',
            "should group ControlPanel's buttons into a dropdown");
        assert.containsNone($controlPanelButtons, '> .btn',
            "there should be no button left in the ControlPanel's left part");

        // open search panel
        await dom.click(dom.find(document.body, '.o_search_panel_current_selection'));
        // select global view
        await dom.click(dom.find(document.body, '.o_search_panel_category_value:first-child header'));
        // close search panel
        await dom.click(dom.find(document.body, '.o_mobile_search_footer'));
        assert.ok(list.$buttons.find('.o_documents_kanban_upload').is(':disabled'),
            "the upload button should be disabled on global view");
        assert.ok(list.$buttons.find('.o_documents_kanban_url').is(':disabled'),
            "the upload url button should be disabled on global view");
        assert.ok(list.$buttons.find('.o_documents_kanban_request').is(':disabled'),
            "the request button should be disabled on global view");
        assert.ok(list.$buttons.find('.o_documents_kanban_share_domain').is(':disabled'),
            "the share button should be disabled on global view");

        // open search panel
        await dom.click(dom.find(document.body, '.o_search_panel_current_selection'));
        // select global view
        await dom.click(dom.find(document.body, '.o_search_panel_category_value:nth-child(2) header'));
        // close search panel
        await dom.click(dom.find(document.body, '.o_mobile_search_footer'));
        assert.ok(list.$buttons.find('.o_documents_kanban_upload').not(':disabled'),
            "the upload button should be enabled when a folder is selected");
        assert.ok(list.$buttons.find('.o_documents_kanban_url').not(':disabled'),
            "the upload url button should be enabled when a folder is selected");
        assert.ok(list.$buttons.find('.o_documents_kanban_request').not(':disabled'),
            "the request button should be enabled when a folder is selected");
        assert.ok(list.$buttons.find('.o_documents_kanban_share_domain').not(':disabled'),
            "the share button should be enabled when a folder is selected");

        list.destroy();
    });

    QUnit.module('DocumentsInspector');

    QUnit.test('toggle inspector based on selection', async function (assert) {
        assert.expect(13);

        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv['documents.folder'].create({ name: 'Workspace1', description: '_F1-test-description_' });
        pyEnv['documents.document'].create([
            { folder_id: documentsFolderId1 },
            { folder_id: documentsFolderId1 },
        ]);
        const list = await createDocumentsView({
            View: DocumentsListView,
            model: 'documents.document',
            arch: `
                <tree>
                    <field name="name"/>
                </tree>
            `,
        });

        assert.isNotVisible(list.$('.o_documents_mobile_inspector'),
            "inspector should be hidden when selection is empty");
        assert.containsN(list, '.o_document_list_record', 2,
            "should have 2 records in the renderer");

        // select a first record
        await dom.click(list.$('.o_document_list_record:first .o_list_record_selector input'));
        await nextTick();
        assert.containsOnce(list, '.o_document_list_record .o_list_record_selector input:checked',
        "should have 1 record selected");
        const toggleInspectorSelector = '.o_documents_mobile_inspector > .o_documents_toggle_inspector';
        assert.isVisible(list.$(toggleInspectorSelector),
        "toggle inspector's button should be displayed when selection is not empty");
        assert.strictEqual(list.$(toggleInspectorSelector).text().replace(/\s+/g, " ").trim(), '1 document selected');

        await dom.click(list.$(toggleInspectorSelector));
        assert.isVisible(list.$('.o_documents_mobile_inspector'),
            "inspector should be opened");

        await dom.click(list.$('.o_documents_close_inspector'));
        assert.isNotVisible(list.$('.o_documents_mobile_inspector'),
            "inspector should be closed");

        // select a second record
        await dom.click(list.$('.o_document_list_record:eq(1) .o_list_record_selector input'));
        await nextTick();
        assert.containsN(list, '.o_document_list_record .o_list_record_selector input:checked', 2,
            "should have 2 records selected");
        assert.strictEqual(list.$(toggleInspectorSelector).text().replace(/\s+/g, " ").trim(), '2 documents selected');

        // click on the record
        await dom.click(list.$('.o_document_list_record:first'));
        await nextTick();
        assert.containsOnce(list, '.o_document_list_record .o_list_record_selector input:checked',
            "should have 1 record selected");
        assert.strictEqual(list.$(toggleInspectorSelector).text().replace(/\s+/g, " ").trim(), '1 document selected');
        assert.isVisible(list.$('.o_documents_mobile_inspector'),
            "inspector should be opened");

        // close inspector
        await dom.click(list.$('.o_documents_close_inspector'));
        assert.containsOnce(list, '.o_document_list_record .o_list_record_selector input:checked',
            "should still have 1 record selected after closing inspector");
    });
    });

});
});

});
