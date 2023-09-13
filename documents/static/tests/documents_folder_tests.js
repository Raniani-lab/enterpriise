/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { createFolderView as originalCreateFolderView } from "./documents_test_utils";
import { setupViewRegistries } from "@web/../tests/views/helpers";

import { getFixture, triggerEvent, patchWithCleanup } from "@web/../tests/helpers/utils";

import { toggleActionMenu, toggleMenuItem } from "@web/../tests/search/helpers";

function createFolderView(params) {
    return originalCreateFolderView({
        serverData: { models: pyEnv.getData(), views: {} },
        ...params,
    });
}

let target;
let pyEnv;

QUnit.module('documents', {}, function () {
QUnit.module('documents_folder_tests.js', {
    async beforeEach() {
        pyEnv = await startServer();
        const documentsFolderIds = pyEnv['documents.folder'].create([
            { name: 'Workspace1', has_write_access: true },
            { name: 'Workspace2', has_write_access: true },
        ]);
        documentsFolderIds.push(
            pyEnv['documents.folder'].create([
                { name: 'Workspace3', parent_folder_id: documentsFolderIds[0], has_write_access: true },
            ])
        );
        setupViewRegistries();
        target = getFixture();
    },
    afterEach() {
        pyEnv = undefined;
    },
}, function () {
    QUnit.test("Folder tree view : Delete one workspace", async function (assert) {
        assert.expect(2);

        const list = await createFolderView({
            type: "list",
            resModel: 'documents.folder',
            arch: `
            <tree string="Workspaces" js_class="folder_list">
                <field name="display_name" string="Workspace"/>
            </tree>`,
            loadActionMenus: true,
        });
        patchWithCleanup(list.env.services.action, {
            doAction(action) {
                assert.strictEqual(action, "documents.documents_folder_deletion_wizard_action");
            },
        });

        await triggerEvent(target, '.o_data_row:nth-child(1) input', 'click');
        assert.ok(target.querySelector('.o_data_row input').checked, "the record should be selected");

        await toggleActionMenu(target);
        await toggleMenuItem(target, "Delete");
    });

    QUnit.test("Folder tree view : Delete multiple workspace", async function (assert) {
        assert.expect(1);

        const list = await createFolderView({
            type: "list",
            resModel: 'documents.folder',
            arch: `
            <tree string="Workspaces" js_class="folder_list">
                <field name="display_name" string="Workspace"/>
            </tree>`,
            loadActionMenus: true,
        });
        patchWithCleanup(list.env.services.action, {
            doAction() {
                // Should not trigger an action
                throw new Error("Should not call doAction");
            },
        });

        await triggerEvent(target, '.o_data_row:nth-child(1) input', 'click');
        await triggerEvent(target, '.o_data_row:nth-child(2) input', 'click');
        assert.containsN(target, ".o_data_row input:checked", 2, "2 records should be selected");

        await toggleActionMenu(target);
        await toggleMenuItem(target, "Delete");
    });
});
});
