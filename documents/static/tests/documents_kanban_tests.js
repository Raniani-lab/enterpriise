odoo.define('documents.documents_kanban_tests', function (require) {
"use strict";

var DocumentsKanbanView = require('documents.DocumentsKanbanView');

var mailTestUtils = require('mail.testUtils');

var AbstractStorageService = require('web.AbstractStorageService');
var concurrency = require('web.concurrency');
var RamStorage = require('web.RamStorage');
var relationalFields = require('web.relational_fields');
var testUtils = require('web.test_utils');

var createView = testUtils.createView;

function autocompleteLength() {
    var $el = $('.ui-autocomplete');
    if ($el.length === 0) {
        throw new Error('Autocomplete not found');
    }
    return $el.find('li').length;
}

function searchValue(el, value) {
    var matches = typeof el === 'string' ? $(el) : el;
    if (matches.length !== 1) {
        throw new Error(`Found ${matches.length} elements instead of 1`);
    }
    matches.val(value).trigger('keydown');
}

function createDocumentsKanbanView(params) {
    var archPieces = params.arch.split('</templates>');
    params.arch = archPieces[0] + '</templates>' +
                        '<searchpanel>' +
                            '<field name="folder_id" string="Workspace"/>' +
                            '<field name="tag_ids" select="multi" groupby="facet_id"/>' +
                            '<field name="res_model" select="multi" string="Attached To"/>' +
                        '</searchpanel>' +
                    archPieces[1];
    if (!params.services || !params.services.local_storage) {
        // the searchPanel uses the localStorage to store/retrieve default
        // active category value
        params.services = params.services || {};
        var RamStorageService = AbstractStorageService.extend({
            storage: new RamStorage(),
        });
        params.services.local_storage = RamStorageService;
    }
    return createView(params);
}

QUnit.module('Views');

QUnit.module('DocumentsKanbanView', {
    beforeEach: function () {
        this.data = {
            'documents.document': {
                fields: {
                    active: {string: "Active", type: 'boolean', default: true},
                    available_rule_ids: {string: "Rules", type: 'many2many', relation: 'documents.workflow.rule'},
                    file_size: {string: "Size", type: 'integer'},
                    folder_id: {string: "Folders", type: 'many2one', relation: 'documents.folder'},
                    lock_uid: {string: "Locked by", type: "many2one", relation: 'user'},
                    message_follower_ids: {string: "Followers", type: 'one2many', relation: 'mail.followers'},
                    message_ids: {string: "Messages", type: 'one2many', relation: 'mail.message'},
                    mimetype: {string: "Mimetype", type: 'char', default: ''},
                    name: {string: "Name", type: 'char', default: ' '},
                    owner_id: {string: "Owner", type: "many2one", relation: 'user'},
                    partner_id: {string: "Related partner", type: 'many2one', relation: 'user'},
                    public: {string: "Is public", type: 'boolean'},
                    res_id: {string: "Resource id", type: 'integer'},
                    res_model: {string: "Model (technical)", type: 'char'},
                    res_model_name: {string: "Resource model", type: 'char'},
                    res_name: {string: "Resource name", type: 'char'},
                    share_ids: {string: "Shares", type: "many2many", relation: 'documents.share'},
                    tag_ids: {string: "Tags", type: 'many2many', relation: 'documents.tag'},
                    type: {string: "Type", type: 'selection', selection: [['url', "URL"], ['binary', "File"]], default: 1},
                    url: {string: "Url", type: 'char'},
                    activity_ids: {string: 'Activities', type: 'one2many', relation: 'mail.activity',
                        relation_field: 'res_id'},
                    activity_state: {string: 'State', type: 'selection',
                        selection: [['overdue', 'Overdue'], ['today', 'Today'], ['planned', 'Planned']]},
                },
                records: [
                    {id: 1, name: 'yop', file_size: 30000, owner_id: 1, partner_id: 2,
                        public: true, res_id: 1, res_model: 'task', res_model_name: 'Task', activity_ids: [1],
                        activity_state: 'today', res_name: 'Write specs', tag_ids: [1, 2], share_ids: [], folder_id: 1,
                        available_rule_ids: [1, 2, 4]},
                    {id: 2, name: 'blip', file_size: 20000, owner_id: 2, partner_id: 2,
                        public: false, res_id: 2, res_model: 'task', res_model_name: 'Task',
                        res_name: 'Write tests', tag_ids: [2], share_ids: [], folder_id: 1, available_rule_ids: [1]},
                    {id: 3, name: 'gnap', file_size: 15000, lock_uid: 3, owner_id: 2, partner_id: 1,
                        public: false, res_id: 2, res_model: 'documents.document', res_model_name: 'Task',
                        res_name: 'Write doc', tag_ids: [1, 2, 5], share_ids: [], folder_id: 1, available_rule_ids: [1, 2, 3, 4]},
                    {id: 4, name: 'burp', file_size: 10000, mimetype: 'image/png', owner_id: 1, partner_id: 3,
                        public: true, res_id: 1, res_model: 'order', res_model_name: 'Sale Order',
                        res_name: 'SO 0001', tag_ids: [], share_ids: [], folder_id: 1, available_rule_ids: []},
                    {id: 5, name: 'zip', file_size: 40000, lock_uid: 1, owner_id: 2, partner_id: 2,
                        public: false, res_id: 3, res_model: false, res_model_name: false,
                        res_name: false, tag_ids: [], share_ids: [], folder_id: 1, available_rule_ids: [1, 2]},
                    {id: 6, name: 'pom', file_size: 70000, partner_id: 3,
                        public: true, res_id: 1, res_model: 'documents.document', res_model_name: 'Document',
                        res_name: 'SO 0003', tag_ids: [], share_ids: [], folder_id: 2, available_rule_ids: []},
                    {id: 8, active: false, name: 'wip', file_size: 70000, owner_id: 3, partner_id: 3,
                        public: true, res_id: 1, res_model: 'order', res_model_name: 'Sale Order',
                        res_name: 'SO 0003', tag_ids: [], share_ids: [], folder_id: 1, available_rule_ids: []},
                    {id: 9, active: false, name: 'zorro', file_size: 20000, mimetype: 'image/png',
                        owner_id: 3, partner_id: 3, public: true, res_id: false, res_model: false,
                        res_model_name: false, res_name: false, tag_ids: [], share_ids: [], folder_id: 1, available_rule_ids: []},
                ],
            },
            "ir.attachment": {
                fields: {
                    res_id: {string: "Resource id", type: 'integer'},
                    res_model: {string: "Model (technical)", type: 'char'},
                },
                records: [],
            },
            'user': {
                fields: {
                    display_name: {string: "Name", type: 'char'},
                },
                records: [
                    {id: 1, display_name: 'Hazard'},
                    {id: 2, display_name: 'Lukaku'},
                    {id: 3, display_name: 'De Bruyne'},
                ],
            },
            'task': {
                fields: {},
                get_formview_id: function () {
                    return Promise.resolve();
                },
            },
            'documents.folder': {
                fields: {
                    name: {string: 'Name', type: 'char'},
                    parent_folder_id: {string: 'Parent Folder', type: 'many2one', relation: 'documents.folder'},
                    description: {string: 'Description', type:'text'},
                },
                records: [
                        {id: 1, name: 'Folder1', description: '_F1-test-description_', parent_folder_id: false},
                        {id: 2, name: 'Folder2', parent_folder_id: false},
                        {id: 3, name: 'Folder3', parent_folder_id: 1},
                ],
            },
            'documents.tag': {
                fields: {},
                get_tags: function () {
                    return [{
                      group_id: 2,
                      group_name: 'Priority',
                      group_sequence: 10,
                      group_tooltip: 'A priority tooltip',
                      id: 5,
                      name: 'No stress',
                      sequence: 10,
                      count: 0,
                    }, {
                      group_id: 1,
                      group_name: 'Status',
                      group_sequence: 11,
                      group_tooltip: 'A Status tooltip',
                      id: 2,
                      name: 'Draft',
                      sequence: 10,
                      count: 0,
                    }, {
                      group_id: 1,
                      group_name: 'Status',
                      group_sequence: 11,
                      group_tooltip: 'A Status tooltip',
                      id: 1,
                      name: 'New',
                      sequence: 11,
                      count: 0,
                    }];
                },
            },
            'documents.share': {
                fields: {
                    name: {string: 'Name', type: 'char'},
                },
                records: [
                    {id: 1, name: 'Share1'},
                    {id: 2, name: 'Share2'},
                    {id: 3, name: 'Share3'},
                ],
                create_share: function () {
                    return Promise.resolve();
                },
            },
            'documents.workflow.rule': {
                fields: {
                    display_name: {string: 'Name', type: 'char'},
                    note: {string: 'Tooltip', type: 'char'},
                    limited_to_single_record: {string: 'Single Record', type: 'boolean'},
                },
                records: [
                    {id: 1, display_name: 'Convincing AI not to turn evil', note: 'Racing for AI Supremacy', limited_to_single_record: false},
                    {id: 2, display_name: 'Follow the white rabbit', limited_to_single_record: false},
                    {id: 3, display_name: 'Entangling superstrings', limited_to_single_record: false},
                    {id: 4, display_name: 'One record rule', limited_to_single_record: true},
                ],
            },
            'mail.followers': {
                fields: {},
                records: [],
            },
            'mail.message': {
                fields: {
                    body: {string: "Body", type: 'char'},
                    model: {string: "Related Document Model", type: 'char'},
                    res_id: {string: "Related Document ID", type: 'integer'},
                },
                records: [],
            },
            'mail.activity': {
                fields: {
                    activity_type_id: { string: "Activity type", type: "many2one", relation: "mail.activity.type" },
                    create_uid: { string: "Created By", type: "many2one", relation: 'partner' },
                    display_name: { string: "Display name", type: "char" },
                    date_deadline: { string: "Due Date", type: "date" },
                    can_write: { string: "Can write", type: "boolean" },
                    user_id: { string: "Assigned to", type: "many2one", relation: 'partner' },
                    state: {
                        string: 'State',
                        type: 'selection',
                        selection: [['overdue', 'Overdue'], ['today', 'Today'], ['planned', 'Planned']],
                    },
                },
            },
            'mail.activity.type': {
                fields: {
                    name: { string: "Name", type: "char" },
                },
                records: [
                    { id: 1, name: "Type 1" },
                    { id: 2, name: "Type 2" },
                ],
            },
        };
    },
}, function () {
    QUnit.test('basic rendering', async function (assert) {
        assert.expect(19);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsOnce(kanban, '.o_search_panel_category_value:contains(All) header',
            "Should only have a single all selector");

        testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(0)'));

        assert.ok(kanban.$buttons.find('.o_documents_kanban_upload').is(':disabled'),
            "the upload button should be disabled on global view");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_url').is(':disabled'),
            "the upload url button should be disabled on global view");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_request').is(':disabled'),
            "the request button should be disabled on global view");
        assert.ok(kanban.$buttons.find('.o_documents_kanban_share').is(':disabled'),
            "the share button should be disabled on global view");

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 6,
            "should have 6 records in the renderer");
        assert.containsNone(kanban, '.o_documents_selector_tags',
            "should not display the tag navigation because no folder is selected by default");

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));

        // check view layout
        assert.containsN(kanban, '.o_content > div', 3,
            "should have 3 columns");
        assert.containsOnce(kanban.$('.o_content'), '> div.o_search_panel',
            "should have a 'documents selector' column");
        assert.containsOnce(kanban, '.o_content > .o_kanban_view',
            "should have a 'classical kanban view' column");
        assert.hasClass(kanban.$('.o_kanban_view'), 'o_documents_kanban_view',
            "should have classname 'o_documents_kanban_view'");
        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 5,
            "should have 5 records in the renderer");
        assert.containsOnce(kanban, '.o_kanban_record:first .o_record_selector',
            "should have a 'selected' button");
        assert.containsOnce(kanban, '.o_content > .o_documents_inspector',
            "should have a 'documents inspector' column");

        // check control panel buttons
        assert.containsN(kanban, '.o_cp_buttons .btn-primary', 3,
            "should have three primary buttons");
        assert.strictEqual(kanban.$('.o_cp_buttons .btn-primary:first').text().trim(), 'Upload',
            "should have a primary 'Upload' button");
        assert.containsOnce(kanban, '.o_cp_buttons button.o_documents_kanban_url',
            "should allow to save a URL");
        assert.strictEqual(kanban.$('.o_cp_buttons button.o_documents_kanban_request').text().trim(), 'Request Document',
            "should have a primary 'request' button");
        assert.strictEqual(kanban.$('.o_cp_buttons button.btn-secondary').text().trim(), 'Share',
            "should have a secondary 'Share' button");

        kanban.destroy();
    });

    QUnit.test('can select records by clicking on the select icon', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        var $firstRecord = kanban.$('.o_kanban_record:first');
        assert.doesNotHaveClass($firstRecord, 'o_record_selected',
            "first record should not be selected");
        await testUtils.dom.click($firstRecord.find('.o_record_selector'));
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should be selected");

        var $thirdRecord = kanban.$('.o_kanban_record:nth(2)');
        assert.doesNotHaveClass($thirdRecord, 'o_record_selected',
            "third record should not be selected");
        await testUtils.dom.click($thirdRecord.find('.o_record_selector'));
        assert.hasClass($thirdRecord, 'o_record_selected',
            "third record should be selected");

        await testUtils.dom.click($firstRecord.find('.o_record_selector'));
        assert.doesNotHaveClass($firstRecord, 'o_record_selected',
            "first record should not be selected");
        assert.hasClass($thirdRecord, 'o_record_selected',
            "third record should be selected");

        kanban.destroy();
    });

    QUnit.test('can select records by clicking on them', async function (assert) {
        assert.expect(5);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsNone(kanban, '.o_kanban_record.o_record_selected',
            "no record should be selected");

        var $firstRecord = kanban.$('.o_kanban_record:first');
        await testUtils.dom.click($firstRecord);
        assert.containsOnce(kanban, '.o_kanban_record.o_record_selected',
            "one record should be selected");
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should be selected");

        var $thirdRecord = kanban.$('.o_kanban_record:nth(2)');
        await testUtils.dom.click($thirdRecord);
        assert.containsOnce(kanban, '.o_kanban_record.o_record_selected',
            "one record should be selected");
        assert.hasClass($thirdRecord, 'o_record_selected',
            "third record should be selected");

        kanban.destroy();
    });

    QUnit.test('can unselect a record', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsNone(kanban, '.o_kanban_record.o_record_selected');

        var $firstRecord = kanban.$('.o_kanban_record:first');
        await testUtils.dom.click($firstRecord);
        assert.hasClass($firstRecord, 'o_record_selected');

        await testUtils.dom.click($firstRecord);
        assert.containsNone(kanban, '.o_kanban_record.o_record_selected');

        kanban.destroy();
    });

    QUnit.test('can select records with keyboard navigation', async function (assert) {
        assert.expect(4);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<button name="some_method" type="object"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            intercepts: {
                execute_action: function () {
                    assert.ok(false, "should not trigger an 'execute_action' event");
                },
            },
        });

        var $firstRecord = kanban.$('.o_kanban_record:first');
        assert.doesNotHaveClass($firstRecord, 'o_record_selected',
            "first record should not be selected");
        $firstRecord.focus().trigger($.Event('keydown', {
            keyCode: $.ui.keyCode.ENTER,
            which: $.ui.keyCode.ENTER,
        }));
        await testUtils.nextTick();
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should be selected");

        var $thirdRecord = kanban.$('.o_kanban_record:nth(2)');
        $thirdRecord.focus().trigger($.Event('keydown', {
            keyCode: $.ui.keyCode.ENTER,
            which: $.ui.keyCode.ENTER,
        }));
        await testUtils.nextTick();
        assert.hasClass($thirdRecord, 'o_record_selected',
            "third record should be selected");
        assert.doesNotHaveClass($firstRecord, 'o_record_selected',
            "first record should no longer be selected");

        kanban.destroy();
    });

    QUnit.test('can multi select records with shift and ctrl', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<button name="some_method" type="object"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });
        var $firstRecord = kanban.$('.o_kanban_record:first');
        assert.doesNotHaveClass($firstRecord, 'o_record_selected',
            "first record should not be selected");
        $firstRecord.focus().trigger($.Event('keydown', {
            keyCode: $.ui.keyCode.ENTER,
            which: $.ui.keyCode.ENTER,
        }));
        await testUtils.nextTick();
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should be selected");

        var $thirdRecord = kanban.$('.o_kanban_record:nth(2)');
        $thirdRecord.focus().trigger($.Event('keydown', {
            keyCode: $.ui.keyCode.ENTER,
            which: $.ui.keyCode.ENTER,
            shiftKey: true,
        }));
        await testUtils.nextTick();
        assert.hasClass($thirdRecord, 'o_record_selected',
            "third record should be selected (shift)");
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should still be selected (shift)");

        $firstRecord.focus().trigger($.Event('keydown', {
            keyCode: $.ui.keyCode.ENTER,
            which: $.ui.keyCode.ENTER,
            ctrlKey: true,
        }));
        await testUtils.nextTick();

        assert.hasClass($thirdRecord, 'o_record_selected',
            "third record should still be selected (ctrl)");
        assert.doesNotHaveClass($firstRecord, 'o_record_selected',
            "first record should no longer be selected (ctrl)");

        kanban.destroy();
    });

    QUnit.test('only visible selected records are kept after a reload', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<button name="some_method" type="object"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(burp) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(blip) .o_record_selector'));


        assert.containsN(kanban, '.o_record_selected', 3,
            "should have 3 selected records");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 3,
            "should show 3 document previews in the DocumentsInspector");

        await kanban.reload({domain: [['name', '=', 'burp']]});

        assert.containsOnce(kanban, '.o_record_selected',
            "should have 1 selected record");
        assert.containsOnce(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show 1 document preview in the DocumentsInspector");

        await kanban.reload({domain: []});

        assert.containsOnce(kanban, '.o_record_selected',
            "should have 1 selected records");
        assert.containsOnce(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show 1 document previews in the DocumentsInspector");

        kanban.destroy();
    });

    QUnit.test('selected records are kept when a button is clicked', async function (assert) {
        assert.expect(7);

        var self = this;
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<button name="some_method" type="object"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'read' && args.model === 'documents.document') {
                    assert.deepEqual(args.args[0], [1],
                        "should read the clicked record");
                }
                return this._super.apply(this, arguments);
            },
            intercepts: {
                execute_action: function (ev) {
                    assert.strictEqual(ev.data.action_data.name, 'some_method',
                        "should call the correct method");
                    self.data['documents.document'].records[0].name = 'yop changed';
                    ev.data.on_closed();
                },
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(burp) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(blip) .o_record_selector'));

        assert.containsN(kanban, '.o_record_selected', 3,
            "should have 3 selected records");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 3,
            "should show 3 document previews in the DocumentsInspector");

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop) button'));

        assert.strictEqual(kanban.$('.o_record_selected:contains(yop changed)').length, 1,
            "should have re-rendered the updated record");
        assert.containsN(kanban, '.o_record_selected', 3,
            "should still have 3 selected records");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 3,
            "should still show 3 document previews in the DocumentsInspector");

        kanban.destroy();
    });

    QUnit.test('can share current domain', async function (assert) {
        assert.expect(2);

        var domain = [['owner_id', '=', 2]];
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            domain: domain,
            mockRPC: function (route, args) {
                if (args.method === 'create_share') {
                    assert.deepEqual(args.args, [{
                        domain: domain.concat([
                            ['folder_id', '=', 1], ['res_model', 'in', ['task']],
                        ]),
                        folder_id: 1,
                        tag_ids: [[6, 0, []]],
                        type: 'domain',
                    }]);
                }
                return this._super.apply(this, arguments);
            },
        });
        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        // filter on 'task' in the DocumentsSelector
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="task"] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_record:not(.o_kanban_ghost)', 1,
            "should have 2 records in the renderer");

        await testUtils.dom.click(kanban.$buttons.find('.o_documents_kanban_share'));

        kanban.destroy();
    });

    QUnit.test('can upload from URL', async function (assert) {
        assert.expect(1);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            intercepts: {
                do_action: function (ev) {
                    assert.deepEqual(ev.data.action, "documents.action_url_form", "should open the URL form");
                },
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$buttons.find('button.o_documents_kanban_url'));

        kanban.destroy();
    });

    QUnit.test('can upload files', async function (assert) {
        assert.expect(1);

        const prom = testUtils.makeTestPromise();

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'create') {
                    assert.deepEqual(args.args[0], [{
                        // as upload has been done ($.ajax() call cannot be mocked),
                        // attachment_id is unknown.
                        attachment_id: args.args[0][0].attachment_id,
                        folder_id: false,
                        name: 'file.txt',
                        tag_ids: [[6, 0, []]]
                    }],
                        "should create a new document");
                    prom.resolve();
                }
                return this._super.apply(this, arguments);
            },
        });

        const file = await testUtils.file.createFile({
            name: 'file.txt',
            content: 'test',
            contentType: 'plain/text',
        });
        testUtils.file.dropFile(kanban.$('.o_documents_kanban_view'), file);
        await prom;
        kanban.destroy();

    });

    QUnit.test('can Request a file', async function (assert) {
        assert.expect(1);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            intercepts: {
                do_action: function (ev) {
                    assert.deepEqual(ev.data.action, "documents.action_request_form", "should open the Request form");
                },
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$buttons.find('button.o_documents_kanban_request'));

        kanban.destroy();
    });

    QUnit.module('DocumentsInspector');

    QUnit.test('documents inspector with no document selected', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });
        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        assert.strictEqual(kanban.$('.o_documents_inspector_preview').text().replace(/\s+/g, ''),
            '_F1-test-description_', "should display the current folder description");
        assert.strictEqual(kanban.$('.o_documents_inspector_info .o_inspector_value:first').text().trim(),
            '5', "should display the correct number of documents");
        assert.strictEqual(kanban.$('.o_documents_inspector_info .o_inspector_value:nth(1)').text().trim(),
            '0.12 MB', "should display the correct size");

        kanban.destroy();
    });

    QUnit.test('documents inspector with selected documents', async function (assert) {
        assert.expect(5);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select a first document
        await testUtils.dom.click(kanban.$('.o_kanban_record:first .o_record_selector'));

        assert.containsNone(kanban, '.o_documents_inspector_info .o_selection_size',
            "should not display the number of selected documents (because only 1)");
        assert.containsOnce(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show a preview of the selected document");
        assert.hasClass(kanban.$('.o_documents_inspector_preview .o_document_preview'), 'o_documents_single_preview',
            "should have the 'o_documents_single_preview' className");

        // select a second document
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(2) .o_record_selector'));

        assert.strictEqual(kanban.$('.o_documents_inspector_preview .o_selection_size').text().trim(),
            '2 documents selected', "should display the correct number of selected documents");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 2,
            "should show a preview of the selected documents");

        kanban.destroy();
    });

    QUnit.test('documents inspector limits preview to 4 documents', async function (assert) {
        assert.expect(2);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select five documents
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(0) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(1) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(2) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(3) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(4) .o_record_selector'));

        assert.strictEqual(kanban.$('.o_documents_inspector_preview .o_selection_size').text().trim(),
            '5 documents selected', "should display the correct number of selected documents");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 4,
            "should only show a preview of 4 selected documents");

        kanban.destroy();
    });

    QUnit.test('documents inspector shows selected records of the current page', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban limit="2"><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));

        assert.containsOnce(kanban, '.o_record_selected',
            "should have 1 selected record");
        assert.containsOnce(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show 1 document preview in the DocumentsInspector");

        await testUtils.dom.click(kanban.pager.$('.o_pager_next'));
        await testUtils.nextTick();

        assert.containsNone(kanban, '.o_record_selected',
            "should have no selected record");
        assert.containsNone(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show no document preview in the DocumentsInspector");

        await testUtils.dom.click(kanban.pager.$('.o_pager_previous'));
        await testUtils.nextTick();

        assert.containsNone(kanban, '.o_record_selected',
            "should have no selected record");
        assert.containsNone(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show no document preview in the DocumentsInspector");

        kanban.destroy();
    });

    QUnit.test('document inspector: document preview', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));

        assert.containsNone(kanban, '.o_document_preview img',
            "should not have a clickable image");

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(burp)'));

        assert.containsNone(kanban, '.o_viewer_content',
            "should not have a document preview");
        assert.containsOnce(kanban, '.o_document_preview img',
            "should have a clickable image");

        await testUtils.dom.click(kanban.$('.o_document_preview img'));

        assert.containsOnce(kanban, '.o_viewer_content',
            "should have a document preview");
        assert.containsOnce(kanban, '.o_close_btn',
            "should have a close button");

        await testUtils.dom.click(kanban.$('.o_close_btn'));

        assert.containsNone(kanban, '.o_viewer_content',
            "should not have a document preview after pdf exit");

        kanban.destroy();
    });

    QUnit.test('document inspector: open preview while modifying document', async function (assert) {
        assert.expect(2);
        var def = testUtils.makeTestPromise();

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    return def;
                }
                return this._super.apply(this, arguments);
            },
        });
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(burp)'));
        kanban.$('input[name=name]').val("foo").trigger('input');

        await testUtils.dom.click(kanban.$('.o_document_preview img'));
        await testUtils.nextTick();
        assert.containsNone(kanban, '.o_viewer_content',
            "document preview should have been canceled");

        def.resolve();
        await testUtils.nextTick();
        await testUtils.dom.click(kanban.$('.o_document_preview img'));
        await testUtils.nextTick();
        assert.containsOnce(kanban, '.o_viewer_content',
                "should have a document preview");
        await testUtils.dom.click(kanban.$('.o_close_btn'));
        kanban.destroy();
    });

    QUnit.test('document inspector: can delete records', async function (assert) {
        assert.expect(5);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            domain: [['active', '=', false]],
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'unlink') {
                    assert.deepEqual(args.args[0], [8, 9],
                        "should unlink the selected records");
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(wip) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(zorro) .o_record_selector'));

        assert.containsN(kanban, '.o_record_selected', 2,
            "should have 2 selected records");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 2,
            "should show 2 document previews in the DocumentsInspector");

        await testUtils.dom.click(kanban.$('.o_documents_inspector_info .o_inspector_delete'));
        await testUtils.nextTick();

        assert.containsNone(kanban, '.o_record_selected',
            "should have no selected record");
        assert.containsNone(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show 0 document preview in the DocumentsInspector");

        kanban.destroy();
    });

    QUnit.test('document inspector: can archive records', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args, [[1, 4], {active: false}],
                        "should archive the selected records");
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(burp) .o_record_selector'));

        assert.containsN(kanban, '.o_record_selected', 2,
            "should have 2 selected records");
        assert.containsN(kanban, '.o_documents_inspector_preview .o_document_preview', 2,
            "should show 2 document previews in the DocumentsInspector");

        await testUtils.dom.click(kanban.$('.o_documents_inspector_info .o_inspector_archive'));
        await testUtils.nextTick();

        assert.containsNone(kanban, '.o_record_selected',
            "should have no selected record");
        assert.containsNone(kanban, '.o_documents_inspector_preview .o_document_preview',
            "should show no document preview in the DocumentsInspector");

        await kanban.reload({active: false});

        assert.containsNone(kanban, '.o_kanban_view .o_record_selected',
            "should have no selected archived record");

        kanban.destroy();
    });

    QUnit.test('document inspector: can share records', async function (assert) {
        assert.expect(2);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'create_share') {
                    assert.deepEqual(args.args, [{
                        document_ids: [[6, 0, [1, 2]]],
                        folder_id: 1,
                        type: 'ids',
                    }]);
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop) .o_record_selector'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(blip) .o_record_selector'));

        assert.containsN(kanban, '.o_record_selected', 2,
            "should have 2 selected records");

        await testUtils.dom.click(kanban.$('.o_documents_inspector_info .o_inspector_share'));

        kanban.destroy();
    });

    QUnit.test('document inspector: locked records', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            session: {
                uid: 1,
            },
        });

        // select a record that is locked by ourself
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(zip)'));

        assert.hasClass(kanban.$('.o_inspector_lock'), 'o_locked',
            "this attachment should be locked");
        assert.notOk(kanban.$('.o_inspector_lock').is(':disabled'),
            "lock button should not be disabled");
        assert.notOk(kanban.$('.o_inspector_replace').is(':disabled'),
            "replace button should not be disabled");

        // select a record that is locked by someone else
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(gnap)'));

        assert.hasClass(kanban.$('.o_inspector_lock'), 'o_locked',
            "this attachment should be locked as well");
        assert.ok(kanban.$('.o_inspector_replace').is(':disabled'),
            "replace button should be disabled");
        assert.ok(kanban.$('.o_inspector_archive').is(':disabled'),
            "archive button should be disabled");

        kanban.destroy();
    });

    QUnit.test('document inspector: can (un)lock records', async function (assert) {
        assert.expect(5);

        var self = this;
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            session: {
                uid: 1,
            },
            mockRPC: function (route, args) {
                if (args.method === 'toggle_lock') {
                    assert.deepEqual(args.args, [1], "should call method for the correct record");
                    var record = _.findWhere(self.data['documents.document'].records, {id: 1});
                    record.lock_uid = record.lock_uid ? false : 1;
                    return Promise.resolve();
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));

        assert.doesNotHaveClass(kanban.$('.o_inspector_lock'), 'o_locked',
            "this attachment should not be locked");

        // lock the record
        await testUtils.dom.click(kanban.$('.o_inspector_lock'));
        await testUtils.nextTick();

        assert.hasClass(kanban.$('.o_inspector_lock'), 'o_locked',
            "this attachment should be locked");


        // unlock the record
        await testUtils.dom.click(kanban.$('.o_inspector_lock'));
        await testUtils.nextTick();

        assert.doesNotHaveClass(kanban.$('.o_inspector_lock'), 'o_locked',
            "this attachment should not be locked anymore");

        kanban.destroy();
    });

    QUnit.test('document inspector: document info with one document selected', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));

        assert.strictEqual(kanban.$('.o_field_widget[name=name]').val(),
            'yop', "should correctly display the name");
        assert.strictEqual(kanban.$('.o_field_widget[name=owner_id] input').val(),
            'Hazard', "should correctly display the owner");
        assert.strictEqual(kanban.$('.o_field_widget[name=partner_id] input').val(),
            'Lukaku', "should correctly display the related partner");
        assert.containsNone(kanban, '.o_field_many2one .o_external_button:visible',
            "should not display the external button in many2ones");
        assert.strictEqual(kanban.$('.o_inspector_model_name').text(),
            ' Task', "should correctly display the resource model");
        assert.strictEqual(kanban.$('.o_inspector_object_name').text(),
            'Write specs', "should correctly display the resource name");

        kanban.destroy();
    });

    QUnit.test('document inspector: update document info with one document selected', async function (assert) {
        assert.expect(6);

        var M2O_DELAY = relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY;
        relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY = 0;

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<field name="owner_id"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args, [[1], {owner_id: 3}],
                        "should save the change directly");
                }
                return this._super.apply(this, arguments);
            },
        });

        var $firstRecord = kanban.$('.o_kanban_record:first');
        assert.strictEqual($firstRecord.text(), 'yopHazard',
            "should display the correct owner");

        await testUtils.dom.click($firstRecord);
        assert.hasClass($firstRecord, 'o_record_selected');

        // change m2o value
        await testUtils.fields.many2one.searchAndClickItem('owner_id', {search: 'De Bruyne'});
        await testUtils.nextTick();

        $firstRecord = kanban.$('.o_kanban_record:first');
        assert.strictEqual($firstRecord.text(), 'yopDe Bruyne',
            "should have updated the owner");
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should still be selected");
        assert.strictEqual(kanban.$('.o_field_many2one[name=owner_id] input').val(), 'De Bruyne',
            "should display the new value in the many2one");

        relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY = M2O_DELAY;
        kanban.destroy();
    });

    QUnit.test('document inspector: document info with several documents selected', async function (assert) {
        assert.expect(7);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select two records with same m2o value
        var $blip = kanban.$('.o_kanban_record:contains(blip)');
        var $gnap = kanban.$('.o_kanban_record:contains(gnap)');
        await testUtils.dom.click($blip);
        await testUtils.dom.click($gnap.find('.o_record_selector'));
        assert.hasClass($blip, 'o_record_selected',
            "blip record should be selected");
        assert.hasClass($gnap, 'o_record_selected',
            "gnap record should be selected");

        assert.strictEqual(kanban.$('.o_field_many2one[name=owner_id] input').val(),
            'Lukaku', "should display the correct m2o value");
        assert.containsNone(kanban, '.o_field_many2one .o_external_button:visible',
            "should not display the external button in many2one");

        // select a third record with another m2o value
        var $yop = kanban.$('.o_kanban_record:contains(yop)');
        await testUtils.dom.click($yop.find('.o_record_selector'));
        assert.hasClass($yop, 'o_record_selected',
            "yop record should be selected");

        assert.strictEqual(kanban.$('.o_field_many2one[name=owner_id] input').val(),
            'Multiple values', "should display 'Multiple values'");
        assert.containsNone(kanban, '.o_field_many2one .o_external_button:visible',
            "should not display the external button in many2one");

        kanban.destroy();
    });

    QUnit.test('document inspector: update document info with several documents selected', async function (assert) {
        assert.expect(10);

        var M2O_DELAY = relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY;
        relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY = 0;

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<field name="owner_id"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args, [[1, 2], {owner_id: 3}],
                        "should save the change directly");
                }
                return this._super.apply(this, arguments);
            },
        });

        var $firstRecord = kanban.$('.o_kanban_record:first');
        assert.strictEqual($firstRecord.text(), 'yopHazard',
            "should display the correct owner (record 1)");
        var $secondRecord = kanban.$('.o_kanban_record:nth(1)');
        assert.strictEqual($secondRecord.text(), 'blipLukaku',
            "should display the correct owner (record 2)");

        await testUtils.dom.click($firstRecord);
        await testUtils.dom.click($secondRecord.find('.o_record_selector'));
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should be selected");
        assert.hasClass($secondRecord, 'o_record_selected',
            "second record should be selected");

        // change m2o value for both records
        await testUtils.fields.many2one.searchAndClickItem('owner_id', {search: 'De Bruyne'});
        await testUtils.nextTick();

        $firstRecord = kanban.$('.o_kanban_record:first');
        assert.strictEqual($firstRecord.text(), 'yopDe Bruyne',
            "should have updated the owner of first record");
        $secondRecord = kanban.$('.o_kanban_record:nth(1)');
        assert.strictEqual($secondRecord.text(), 'blipDe Bruyne',
            "should have updated the owner of second record");
        assert.hasClass($firstRecord, 'o_record_selected',
            "first record should still be selected");
        assert.hasClass($secondRecord, 'o_record_selected',
            "second record should still be selected");
        assert.strictEqual(kanban.$('.o_field_many2one[name=owner_id] input').val(), 'De Bruyne',
            "should display the new value in the many2one");

        relationalFields.FieldMany2One.prototype.AUTOCOMPLETE_DELAY = M2O_DELAY;
        kanban.destroy();
    });

    QUnit.test('document inspector: update info: handle concurrent updates', async function (assert) {
        assert.expect(11);

        var def = testUtils.makeTestPromise();
        var nbWrite = 0;
        var value;
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                var result = this._super.apply(this, arguments);
                if (args.method === 'write') {
                    assert.step('write');
                    nbWrite++;
                    assert.deepEqual(args.args, [[1], {name: value}],
                        "should correctly save the changes");
                    if (nbWrite === 1) {
                        return def.then(_.constant(result));
                    }
                }
                return result;
            },
        });

        assert.strictEqual(kanban.$('.o_kanban_record:first').text(), 'yop',
            "should display the correct filename");
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));

        // change filename value of selected record (but block RPC)
        value = 'temp name';
        await testUtils.fields.editInput(kanban.$('.o_field_char[name=name]'), value);

        assert.strictEqual(kanban.$('.o_kanban_record:first').text(), 'yop',
            "should still display the old filename");

        // change filename value again (this RPC isn't blocked but must wait for
        // the first one to return)
        value = 'new name';
        await testUtils.fields.editInput(kanban.$('.o_field_char[name=name]'), value);

        assert.strictEqual(kanban.$('.o_kanban_record:first').text(), 'yop',
            "should still display the old filename");

        assert.step('resolve');
        def.resolve();
        await testUtils.nextTick();
        await testUtils.nextTick();

        assert.strictEqual(kanban.$('.o_kanban_record:first').text(), 'new name',
            "should still display the new filename in the record");
        assert.strictEqual(kanban.$('.o_field_char[name=name]').val(), 'new name',
            "should still display the new filename in the documents inspector");

        assert.verifySteps(['write', 'resolve', 'write']);

        kanban.destroy();
    });

    QUnit.test('document inspector: open resource', async function (assert) {
        assert.expect(1);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            intercepts: {
                do_action: function (ev) {
                    assert.deepEqual(ev.data.action, {
                        res_id: 1,
                        res_model: 'task',
                        type: 'ir.actions.act_window',
                        views: [[false, 'form']],
                    }, "should open the resource in a form view");
                },
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_object_name'));

        kanban.destroy();
    });

    QUnit.test('document inspector: display tags of selected documents', async function (assert) {
        assert.expect(4);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value:eq(1) header'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));

        assert.containsN(kanban, '.o_inspector_tag', 2,
            "should display the tags of the selected document");

        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(1) .o_record_selector'));

        assert.containsN(kanban, '.o_record_selected', 2,
            "should have 2 selected records");
        assert.containsOnce(kanban, '.o_inspector_tag',
            "should display the common tags between the two selected documents");
        assert.strictEqual(kanban.$('.o_inspector_tag').text().replace(/\s/g, ""), 'Status>Draft×',
            "should correctly display the content of the tag");

        kanban.destroy();
    });

    QUnit.test('document inspector: input to add tags is hidden if no tag to add', async function (assert) {
        assert.expect(2);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(gnap)'));

        assert.containsN(kanban, '.o_inspector_tag', 3,
            "should have 3 tags");
        assert.containsNone(kanban, '.o_inspector_tags .o_inspector_tag_add',
            "should not have an input to add tags");

        kanban.destroy();
    });

    QUnit.test('document inspector: remove tag', async function (assert) {
        assert.expect(4);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [1, 3],
                        "should write on the selected records");
                    assert.deepEqual(args.args[1], {
                        tag_ids: [[3, 1]],
                    }, "should write the correct value");
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(2) .o_record_selector'));

        assert.containsN(kanban, '.o_inspector_tag', 2,
            "should display two tags");

        await testUtils.dom.click(kanban.$('.o_inspector_tag:first .o_inspector_tag_remove'));

        assert.containsOnce(kanban, '.o_inspector_tag',
            "should display one tag");

        kanban.destroy();
    });

    QUnit.test('document inspector: add a tag', async function (assert) {
        assert.expect(5);
        var done = assert.async();

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'write') {
                    assert.deepEqual(args.args[0], [1, 2],
                        "should write on the selected records");
                    assert.deepEqual(args.args[1], {
                        tag_ids: [[4, 5]],
                    }, "should write the correct value");
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(1) .o_record_selector'));

        assert.containsOnce(kanban, '.o_inspector_tag');

        searchValue('.o_inspector_tag_add', 'stress');
        concurrency.delay(0).then(async function () {
            assert.strictEqual(autocompleteLength(), 1,
                "should have an entry in the autocomplete drodown");
            var $autocomplete = kanban.$('.o_inspector_tag_add').autocomplete('widget');
            // TO DO understand problem with autocomplete
            await testUtils.dom.click($autocomplete.find('li > a'));

            assert.containsN(kanban, '.o_inspector_tag', 2,
                "should display two tags");

            kanban.destroy();
            done();
        });
    });

    QUnit.test('document inspector: do not suggest already linked tags', async function (assert) {
        assert.expect(2);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));

        assert.containsN(kanban, '.o_inspector_tag', 2,
            "should display two tags");

        searchValue('.o_inspector_tag_add', 'new');
        assert.strictEqual(autocompleteLength(), 0,
            "should have no entry in the autocomplete drodown");

        kanban.destroy();
    });

    QUnit.test('document inspector: tags: trigger a search on input clicked', async function (assert) {
        assert.expect(1);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));
        await testUtils.dom.click(kanban.$('.o_inspector_tag_add'));
        var $autocomplete = kanban.$('.o_inspector_tag_add').autocomplete('widget');
        assert.strictEqual(autocompleteLength(), 1,
            "should have an entry in the autocomplete dropdown");
        await testUtils.dom.click($autocomplete.find('li > a'));

        kanban.destroy();
    });

    QUnit.test('document inspector: unknown tags are hidden', async function (assert) {
        assert.expect(1);

        this.data['documents.document'].records[0].tag_ids = [1, 2, 78];

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));

        assert.containsN(kanban, '.o_inspector_tag', 2,
            "should not display the unknown tag");

        kanban.destroy();
    });

    QUnit.test('document inspector: display rules of selected documents', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));

        assert.containsN(kanban, '.o_inspector_rule', 3,
            "should display the rules of the selected document");

        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(1) .o_record_selector'));

        assert.containsN(kanban, '.o_record_selected', 2,
            "should have 2 selected records");
        assert.containsOnce(kanban, '.o_inspector_rule',
            "should display the common rules between the two selected documents");
        assert.containsOnce(kanban, '.o_inspector_rule .o_inspector_trigger_rule',
            "should display the button for the common rule");
        assert.strictEqual(kanban.$('.o_inspector_rule').text().trim(), 'Convincing AI not to turn evil',
            "should correctly display the content of the rule");
        assert.hasAttrValue(kanban.$('.o_inspector_rule span'), 'title', "Racing for AI Supremacy",
            "should correctly display the tooltip of the rule");

        kanban.destroy();
    });

    QUnit.test('document inspector: displays the right amount of single record rules', async function (assert) {
        assert.expect(2);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(2)'));

        assert.containsN(kanban, '.o_inspector_rule', 4,
            "should display the rules of the selected document (3 multi record, 1 single record)");

        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(0) .o_record_selector'));

        assert.containsN(kanban, '.o_inspector_rule', 2,
            "should display the rules in common except the single record rule");

        kanban.destroy();
    });

    QUnit.test('document inspector: display rules of reloaded record', async function (assert) {
        assert.expect(7);

        var self = this;
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                        '<button name="some_method" type="object"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            intercepts: {
                execute_action: function (ev) {
                    assert.strictEqual(ev.data.action_data.name, 'some_method',
                        "should call the correct method");
                    self.data['documents.document'].records[0].name = 'yop changed';
                    ev.data.on_closed();
                },
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));

        assert.containsN(kanban, '.o_inspector_rule span', 3,
            "should display the rules of the selected document");

        assert.strictEqual(kanban.$('.o_inspector_rule span:eq(0)').text(), 'Convincing AI not to turn evil',
            "should display the right rule");

        assert.strictEqual(kanban.$('.o_inspector_rule span:eq(1)').text(), 'Follow the white rabbit',
            "should display the right rule");

        assert.strictEqual(kanban.$('.o_inspector_rule span:eq(2)').text(), 'One record rule',
            "should display the right rule");

        // click on the button to reload the record
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop) button'));

        assert.strictEqual(kanban.$('.o_record_selected:contains(yop changed)').length, 1,
            "should have reloaded the updated record");

        // unselect and re-select it (the record has been reloaded, so we want
        // to make sure its rules have been reloaded correctly as well)
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop changed)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop changed)'));

        assert.strictEqual(kanban.$('.o_inspector_rule span').text(),
            'Convincing AI not to turn evilFollow the white rabbitOne record rule',
            "should correctly display the rules of the selected document");

        kanban.destroy();
    });

    QUnit.test('document inspector: trigger rule actions on selected documents', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.model === 'documents.workflow.rule' && args.method === 'apply_actions') {
                    assert.deepEqual(args.args[0], [1],
                        "should execute actions on clicked rule");
                    assert.deepEqual(args.args[1], [1, 2],
                        "should execute actions on the selected records");
                    return Promise.resolve();
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:first'));
        await testUtils.dom.click(kanban.$('.o_kanban_record:nth(1) .o_record_selector'));

        assert.containsOnce(kanban, '.o_inspector_rule',
            "should display the common rules between the two selected documents");
        await testUtils.dom.click(kanban.$('.o_inspector_rule .o_inspector_trigger_rule'));

        kanban.destroy();
    });

    QUnit.module('DocumentChatter');

    QUnit.test('document chatter: open and close chatter', async function (assert) {
        assert.expect(7);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsNone(kanban, '.o_document_chatter .o_chatter',
            "should not display any chatter");

        // select a record
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));

        assert.containsNone(kanban, '.o_document_chatter .o_chatter',
            "should still not display any chatter");

        // open the chatter
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");
        assert.containsOnce(kanban, '.o_search_panel:visible',
            "documents selector should still be visible");
        assert.containsOnce(kanban, '.o_kanban_view:visible',
            "kanban view should still be visible");
        assert.containsOnce(kanban, '.o_documents_inspector:visible',
            "documents inspector should still be visible");

        // close the chatter
        await testUtils.dom.click(kanban.$('.o_document_close_chatter'));
        assert.containsNone(kanban, '.o_document_chatter .o_chatter',
            "should no longer display the chatter");

        kanban.destroy();
    });

    QUnit.test('document chatter: fetch and display chatter messages', async function (assert) {
        assert.expect(2);

        this.data['documents.document'].records[0].message_ids = [101, 102];
        this.data['mail.message'].records = [
            {body: "Message 1", id: 101, model: 'documents.document', res_id: 1},
            {body: "Message 2", id: 102, model: 'documents.document', res_id: 1},
        ];

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");
        assert.containsN(kanban, '.o_document_chatter .o_thread_message', 2,
            "should display two messages in the chatter");

        kanban.destroy();
    });

    QUnit.test('document chatter: fetch and display followers', async function (assert) {
        assert.expect(3);

        this.data['documents.document'].records[0].message_follower_ids = [301, 302];

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route) {
                if (route === '/mail/read_followers') {
                    return Promise.resolve({
                        followers: [
                            {id: 301, display_name: 'Follower 1'},
                            {id: 302, display_name: 'Follower 2'},
                        ],
                        subtypes: [],
                    });
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");
        assert.containsOnce(kanban, '.o_document_chatter .o_followers',
            "should display the follower widget");
        assert.strictEqual(kanban.$('.o_document_chatter .o_followers_count').text(), "2",
            "should have two followers");

        kanban.destroy();
    });

    QUnit.test('document chatter: render the activity button', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            intercepts: {
                do_action: function (ev) {
                    assert.deepEqual(ev.data.action, {
                        context: {
                            default_res_id: 1,
                            default_res_model: 'documents.document'
                        },
                        name: "Schedule Activity",
                        res_id: false,
                        res_model: 'mail.activity',
                        target: 'new',
                        type: 'ir.actions.act_window',
                        view_mode: 'form',
                        view_type: 'form',
                        views: [[false, 'form']]
                        },
                        "the activity button should trigger do_action with the correct args"
                    );
                },
            },
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");

        var $activityButton = kanban.$('.o_document_chatter .o_chatter_button_schedule_activity');
        assert.strictEqual($activityButton.length, 1,
            "should display the activity button");
        await testUtils.dom.click($activityButton);

        kanban.destroy();
    });

    QUnit.test('document chatter: render the activity button 2', async function (assert) {
        assert.expect(8);

        this.data['mail.activity'].records = [{
            id: 1,
            display_name: "An activity",
            date_deadline: moment().format("YYYY-MM-DD"),
            state: "today",
            user_id: 2,
            create_uid: 2,
            can_write: true,
            activity_type_id: 1,
        }];
        this.data.partner = {
            fields: {
                display_name: { string: "Displayed name", type: "char" },
                message_ids: {
                    string: "messages",
                    type: "one2many",
                    relation: 'mail.message',
                    relation_field: "res_id",
                },
                activity_ids: {
                    string: 'Activities',
                    type: 'one2many',
                    relation: 'mail.activity',
                    relation_field: 'res_id',
                },
            },
            records: [{
                id: 2,
                display_name: "first partner",
                message_ids: [],
                activity_ids: [],
            }]
        };
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");

        assert.containsOnce(kanban, '.o_mail_activity',
            "should display the activity area");
        assert.containsOnce(kanban, '#o_chatter_activity_info_1',
            "should display an activity");
        assert.strictEqual(kanban.$('.o_activity_link:contains(Mark Done)').length, 1,
            "should display the activity mark done button");
        assert.containsOnce(kanban, '.o_edit_activity',
            "should display the activity Edit button");
        assert.containsOnce(kanban, '.o_unlink_activity',
            "should display the activity Cancel button");

        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(blip)'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");

        assert.containsNone(kanban, '#o_chatter_activity_info_1',
            "should not display an activity");
        kanban.destroy();
    });

    QUnit.test('document chatter: can write messages in the chatter', async function (assert) {
        assert.expect(6);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (args.method === 'message_get_suggested_recipients') {
                    return Promise.resolve({1: []});
                }
                if (args.method === 'message_post') {
                    assert.deepEqual(args.args, [1],
                        "should post message on correct record");
                    assert.strictEqual(args.kwargs.body, 'Some message',
                        "should post correct message");
                    return Promise.resolve(98);
                }
                if (args.method === 'message_format') {
                    assert.deepEqual(args.args, [[98]],
                        "should request message_format on correct message");
                    return Promise.resolve([{}]);
                }
                return this._super.apply(this, arguments);
            },
        });

        // select a record and open the chatter
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");
        assert.containsNone(kanban, '.o_document_chatter .o_thread_composer',
            "chatter composer should not be open");

        // open the composer
        await testUtils.dom.click(kanban.$('.o_document_chatter .o_chatter_button_new_message'));

        assert.containsOnce(kanban, '.o_document_chatter .o_thread_composer',
            "chatter composer should be open");

        // write and send a message
        kanban.$('.o_document_chatter .o_composer_text_field').val('Some message');
        await testUtils.dom.click(kanban.$('.o_document_chatter .o_composer_button_send'));

        kanban.destroy();
    });

    QUnit.test('document chatter: keep chatter open when switching between records', async function (assert) {
        assert.expect(6);

        this.data['documents.document'].records[0].message_ids = [101, 102];
        this.data['mail.message'].records = [
            {body: "Message on 'yop'", id: 101, model: 'documents.document', res_id: 1},
            {body: "Message on 'blip'", id: 102, model: 'documents.document', res_id: 2},
        ];

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select a record and open the chatter
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");
        assert.containsOnce(kanban, '.o_document_chatter .o_thread_message',
            "should display one message in the chatter");
        assert.strictEqual(kanban.$('.o_thread_message .o_thread_message_content').text().trim(),
            "Message on 'yop'", "should display the correct message");

        // select another record
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(blip)'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should still display the chatter");
        assert.containsOnce(kanban, '.o_document_chatter .o_thread_message',
            "should display one message in the chatter");
        assert.strictEqual(kanban.$('.o_thread_message .o_thread_message_content').text().trim(),
            "Message on 'blip'", "should display the correct message");

        kanban.destroy();
    });

    QUnit.test('document chatter: keep chatter open after a reload', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select a record and open the chatter
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");

        // reload with a domain
        await kanban.reload({domain: [['id', '<', 4]]});

        assert.containsOnce(kanban, '.o_record_selected',
            "record should still be selected");
        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should still display the chatter");

        kanban.destroy();
    });

    QUnit.test('document chatter: close chatter when more than one record selected', async function (assert) {
        assert.expect(2);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select a record and open the chatter
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");

        // select another record alongside the first one
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(blip) .o_record_selector'));

        assert.containsNone(kanban, '.o_document_chatter .o_chatter',
            "should have closed the chatter");

        kanban.destroy();
    });

    QUnit.test('document chatter: close chatter when no more selected record', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            services: mailTestUtils.getMailServices(),
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        // select a record and open the chatter
        await testUtils.dom.click(kanban.$('.o_kanban_record:contains(yop)'));
        await testUtils.dom.click(kanban.$('.o_documents_inspector .o_inspector_open_chatter'));

        assert.containsOnce(kanban, '.o_document_chatter .o_chatter',
            "should display the chatter");

        // reload with a domain
        await kanban.reload({domain: [['id', '>', 4]]});

        assert.containsNone(kanban, '.o_record_selected',
            "no more record should be selected");
        assert.containsNone(kanban, '.o_document_chatter .o_chatter',
            "should have closed the chatter");

        kanban.destroy();
    });

    QUnit.module('DocumentsSelector');

    QUnit.test('document selector: basic rendering', async function (assert) {
        assert.expect(18);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value:eq(1) header'));
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_section .o_search_panel_section_header').eq(0).text().trim(),
            'Workspace', "should have a 'Workspace' section");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_category_value', 3,
            "three of them should be visible");
        assert.strictEqual(kanban.$('.o_documents_inspector_preview').text().replace(/\s+/g, ''),
            '_F1-test-description_', "should display the first folder");

        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_section .o_search_panel_section_header').eq(1).text().trim(),
            'Tags', "should have a 'tags' section");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_filter_group', 2,
            "should have 2 facets");

        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:first label:first').text().trim(),
            'Priority', "the first facet should be 'Priority'");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:first label:first').attr('title').trim(),
            'A priority tooltip', "the first facet have a tooltip");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:last label:first').text().trim(),
            'Status', "the last facet should be 'Status'");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:last label:first').attr('title').trim(),
            'A Status tooltip', "the last facet should be 'Status'");

        assert.containsN(kanban, '.o_search_panel .o_search_panel_filter_group:last .o_search_panel_filter_value', 2,
            "should have 2 tags in the last facet");

        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:last .o_search_panel_filter_value:first label').text().trim(),
            'Draft', "the first tag in the last facet should be 'Draft'");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:last .o_search_panel_filter_value:first label').attr('title').trim(),
            'A Status tooltip', "the first tag in the last facet have a tooltip");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:last .o_search_panel_filter_value:last label').text().trim(),
            'New', "the last tag in the last facet should be 'New'");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_group:last .o_search_panel_filter_value:last label').attr('title').trim(),
            'A Status tooltip', "the last tag in the last facet have a tooltip");

        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_section:nth-child(3) .o_search_panel_section_header').text().trim(),
            'Attached To', "should have an 'attached to' section");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_section:nth-child(3) .o_search_panel_filter_value', 4,
            "should have 4 types of models");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=task]').text().replace(/\s/g, ""),
            'Task2', "should display the correct number of records");
        assert.containsOnce(kanban.$('.o_search_panel'), '.o_search_panel_section:nth-child(3) .o_search_panel_filter_value:contains("Not attached")', "should at least have a no-model element");

        kanban.destroy();
    });

    QUnit.test('document selector: render without facets & tags', async function (assert) {
        assert.expect(3);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            mockRPC: function (route, args) {
                if (args.method === 'search_panel_select_multi_range') {
                    return Promise.resolve([]);
                }
                return this._super.apply(this, arguments);
            },
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        assert.strictEqual(kanban.$('.o_search_panel .o_documents_selector_tags .o_search_panel_section_header').text().trim(),
            '', "shouldn't have a 'tags' section");
        assert.containsNone(kanban, '.o_search_panel .o_search_panel_filter_group',
            "shouldn't have any facet");
        assert.containsNone(kanban, '.o_search_panel .o_search_panel_filter_group .o_search_panel_filter_value',
            "shouldn't have any tag");

        kanban.destroy();
    });

    QUnit.test('document selector: render without related models', async function (assert) {
        assert.expect(4);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            domain: [['res_model', '=', false]],
        });

        assert.containsNone(kanban, '.o_search_panel .o_documents_selector_tags .o_search_panel_section_header',
            "shouldn't have a 'tags' section");
        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_section:nth-child(3) .o_search_panel_section_header').text().trim(),
            'Attached To', "should have an 'attached to' section");
        assert.containsNone(kanban, '.o_search_panel .o_search_panel_section:nth-child(3) .o_search_panel_filter_value:contains("Not attached")',
            "should not have an unattached document");
        assert.containsOnce(kanban, '.o_search_panel .o_search_panel_section:nth-child(3) .o_search_panel_filter_value:contains("Not a file")',
            "should at least have a no-model element");

        kanban.destroy();
    });

    QUnit.test('document selector: filter on related model', async function (assert) {
        assert.expect(8);

        // TO: decide what should be done for Attached To section
        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 6, "should have 6 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_section:nth-child(2) .o_search_panel_filter_value', 4, "should have 4 related models");

        // filter on 'Task'
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="task"] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 2, "should have 3 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_section:nth-child(2) .o_search_panel_filter_value', 4, "should have 4 related models");

        // filter on 'Sale Order' (should be a disjunction)
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="order"] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 3, "should have 3 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_section:nth-child(2) .o_search_panel_filter_value', 4, "should still have 4 related models");

        // remove both filters
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="order"] input:checkbox'));
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="task"] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 6, "should have 6 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_section:nth-child(2) .o_search_panel_filter_value', 4, "should still have 4 related models");

        kanban.destroy();
    });

    QUnit.test('document selector: filter on attachments without related model', async function (assert) {
        assert.expect(8);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 6, "should have 6 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_filter_value', 4, "should have 4 related models");

        // filter on 'No Source'
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=false] input:checkbox'));

        assert.containsOnce(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', "should have 1 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_filter_value', 4, "should still have 4 related models");

        // filter on 'Task'
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="task"] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 3, "should have 4 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_filter_value', 4, "should still have 4 related models");

        // remove both filters
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=false] input:checkbox'));
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="task"] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 6, "should have 6 records in the renderer");
        assert.containsN(kanban, '.o_search_panel .o_search_panel_filter_value', 4, "should still have 4 related models");

        kanban.destroy();
    });

    QUnit.test('document selector: mix filter on related model and search filters', async function (assert) {
        assert.expect(10);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 6, "should have 6 records in the renderer");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=task]').text().replace(/\s/g, ""),
            'Task2', "should display the correct number of records");

        // filter on 'Task'
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=task] input:checkbox'));

        assert.strictEqual(kanban.$('.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)').length, 2, "should have 3 records in the renderer");

        // reload with a domain
        await kanban.reload({domain: [['public', '=', true]]});

        assert.containsOnce(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 1, "should have 1 record in the renderer");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="task"]').text().replace(/\s/g, ""),
            'Task1', "should display the correct number of records");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id="order"]').text().replace(/\s/g, ""),
            'SaleOrder', "should display the correct number of records");

        // filter on 'Sale Order'
        await testUtils.dom.click(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=order] input:checkbox'));

        assert.containsN(kanban, '.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)', 2, "should have 2 records in the renderer");

        // reload without the domain
        await kanban.reload({domain: []});

        assert.strictEqual(kanban.$('.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)').length, 3, "should have 4 record in the renderer");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=task]').text().replace(/\s/g, ""),
            'Task2', "should display the correct number of records");
        assert.strictEqual(kanban.$('.o_search_panel .o_search_panel_filter_value[data-value-id=order]').text().replace(/\s/g, ""),
            'SaleOrder1', "should display the correct number of records");

        kanban.destroy();
    });

    QUnit.test('document selector: selected tags are reset when switching between folders', async function (assert) {
        assert.expect(7);

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
            mockRPC: function (route, args) {
                if (route === '/web/dataset/search_read' && args.model === 'documents.document') {
                    assert.step(JSON.stringify(args.domain || []));
                }
                return this._super.apply(this, arguments);
            },
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));
        // filter on records having tag Draft
        await testUtils.dom.click(kanban.$('.o_search_panel_filter_value:contains(Draft) input'));

        assert.ok(kanban.$('.o_search_panel_filter_value:contains(Draft) input').is(':checked'),
            "tag selector should be checked");

        // switch to Folder2
        await testUtils.dom.click(kanban.$('.o_search_panel_category_value:contains(Folder2) header'));

        assert.ok(kanban.$('.o_search_panel_filter_value:contains(Draft) input').is(':checked'),
            "tag selector should not be checked anymore");

        assert.verifySteps([
            '[]',
            '[["folder_id","=",1]]',
            '[["folder_id","=",1],["tag_ids","in",[2]]]',
            '[["folder_id","=",2],["tag_ids","in",[2]]]',
        ]);

        kanban.destroy();
    });

    QUnit.test('document selector: should keep its selection when adding a tag', async function (assert) {
        assert.expect(5);
        var done = assert.async();

        var kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
            arch: '<kanban><templates><t t-name="kanban-box">' +
                    '<div>' +
                        '<field name="name"/>' +
                    '</div>' +
                '</t></templates></kanban>',
        });

        await testUtils.dom.click(kanban.$('.o_search_panel_category_value header:eq(1)'));

        // filter on records having tag Draft
        await testUtils.dom.click(kanban.$('.o_search_panel_filter_value:contains(Draft) input'));

        assert.ok(kanban.$('.o_search_panel_filter_value:contains(Draft) input').is(':checked'),
            "tag selector should be checked");

        assert.strictEqual(kanban.$('.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)').length,
            1, "should have records in the renderer");

        await testUtils.dom.click(kanban.$('.o_kanban_record:first .o_record_selector'));

        searchValue('.o_inspector_tag_add', 'stress');
        concurrency.delay(0).then(async function () {
            assert.strictEqual(autocompleteLength(), 1,
                "should have an entry in the autocomplete drodown");
            var $autocomplete = kanban.$('.o_inspector_tag_add').autocomplete('widget');
            await testUtils.dom.click($autocomplete.find('li > a'));

            assert.ok(kanban.$('.o_search_panel_filter_value:contains(Draft) input').is(':checked'),
                        "tag selector should still be checked");
            assert.strictEqual(kanban.$('.o_kanban_view .o_kanban_record:not(.o_kanban_ghost)').length,
            1, "should still have the same records in the renderer");

            kanban.destroy();
            done();
        });
    });
});

});
