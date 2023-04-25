/** @odoo-module */

import { getFixture, nextTick } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { qweb as QWeb } from 'web.core';
import { parseHTML } from '@web_editor/js/editor/odoo-editor/src/utils/utils'

/**
 * Insert an "External" view inside knowledge article.
 * @param {HTMLElement} editable
 */
const insertExternalView = async (editable) => {
    const wysiwyg = $(editable).data('wysiwyg');

    const insertedDiv = parseHTML(QWeb.render('knowledge.abstract_behavior', {
        behaviorType: "o_knowledge_behavior_type_template",
    })).firstChild;
    wysiwyg.appendBehaviorBlueprint(insertedDiv);
    await nextTick();
};

let fixture;
let type;
let resModel;
let serverData;
let arch;

QUnit.module("Knowledge - External View Insertion", (hooks) => {
    hooks.beforeEach(() => {
        fixture = getFixture();
        type = "form";
        resModel = "knowledge_article";
        serverData = {
            models: {
                knowledge_article: {
                    fields: {
                        display_name: {string: "Displayed name", type: "char"},
                        body: {string: "Body", type: 'html'},
                    },
                    records: [{
                        id: 1,
                        display_name: "Insertion Article",
                        body: '\n<p>\n<br/>\n</p>\n',
                    }]
                }
            }
        };
        arch = '<form js_class="knowledge_article_view_form">' +
            '<sheet>' +
                '<div t-ref="tree"/>' +
                '<div t-ref="root">' +
                    '<div class="o_knowledge_editor">' +
                        '<field name="body" widget="html"/>' +
                    '</div>' +
                '</div>' +
            '</sheet>' +
        '</form>';
        setupViewRegistries();
    });
    QUnit.test('Check that the insertion of views goes as expected', async function (assert) {

        await makeView({
            type,
            resModel,
            serverData,
            arch,
            resId: 1
        });

        const editable = fixture.querySelector('.odoo-editor-editable');
        await insertExternalView(editable);

        // We are checking if the anchor has been correctly inserted inside
        // the article.
        assert.containsOnce(editable, '.o_knowledge_behavior_anchor');
        const anchor = editable.querySelector('.o_knowledge_behavior_anchor');
        assert.notOk(anchor.nextSiblingElement, 'The inserted view should be the last element in the article');
    });
});
