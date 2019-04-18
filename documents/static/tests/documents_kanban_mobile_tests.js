odoo.define('documents.mobile_tests', function (require) {
"use strict";

const DocumentsKanbanView = require('documents.DocumentsKanbanView');
const {createDocumentsKanbanView} = require('documents.test_utils');

QUnit.module('Views');

QUnit.module('DocumentsKanbanViewMobile', {
    beforeEach() {
        this.data = {
            'documents.document': {
                fields: {
                    available_rule_ids: {string: "Rules", type: 'many2many', relation: 'documents.workflow.rule'},
                    folder_id: {string: "Folders", type: 'many2one', relation: 'documents.folder'},
                    res_model: {string: "Model (technical)", type: 'char'},
                    tag_ids: {string: "Tags", type: 'many2many', relation: 'documents.tag'},
                },
                records: [
                ],
            },
            'documents.folder': {
                fields: {},
                records: [],
            },
        };
    },
}, function () {
    QUnit.test('basic rendering on mobile', async function (assert) {
        assert.expect(2);

        const kanban = await createDocumentsKanbanView({
            View: DocumentsKanbanView,
            model: 'documents.document',
            data: this.data,
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

        kanban.destroy();
    });
});

});
