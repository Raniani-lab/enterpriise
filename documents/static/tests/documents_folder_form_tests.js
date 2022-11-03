/** @odoo-module **/

import {
    getFixture,
    patchWithCleanup,
} from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";

import { toggleActionMenu, toggleMenuItem } from "@web/../tests/search/helpers";

let target;
let serverData;

QUnit.module('documents', {}, function () {
QUnit.module('documents_folder_form_tests.js', {
    beforeEach: function () {
        this.data = {
            'documents.folder': {
                fields: {
                    id: {type: 'integer'},
                    display_name: { string: "Displayed name", type: "char" },
                    parent_folder_id: {type: 'many2one', relation: 'documents.folder'},
                },
                records: [{
                    id: 1,
                    display_name: "Workspace_parent",
                    parent_folder_id: false,
                },
                {
                    id: 2,
                    display_name: "Workspace_child",
                    parent_folder_id: 1,
                },
            ]
            },
        };
        serverData = { models: this.data };
        setupViewRegistries();
        target = getFixture();
    },
}, function () {
    QUnit.test("Folder delete form view", async function (assert) {
        assert.expect(1);
        const form = await makeView({
            type: "form",
            resModel: "documents.folder",
            serverData,
            arch: `
                <form js_class="folder_form">
                    <sheet>
                        <field name="parent_folder_id"/>
                    </sheet>
                </form>`,
            resId: 2,
            loadActionMenus: true,
        });
        patchWithCleanup(form.env.services.action, {
            doAction(action) {
                assert.strictEqual(action, "documents.documents_folder_deletion_wizard_action");
            },
        });

        await toggleActionMenu(target);
        await toggleMenuItem(target, "Delete");
    });
});
});
