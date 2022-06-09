/** @odoo-module */

import { createDocumentsView } from "documents.test_utils";
import DocumentsKanbanView from "documents_spreadsheet.KanbanView";
import DocumentsListView from "documents_spreadsheet.ListView";
import { dom, fields } from "web.test_utils";

import { startServer } from "@mail/../tests/helpers/test_utils";

import { nextTick, click } from "@web/../tests/helpers/utils";
import { getBasicData } from "@spreadsheet/../tests/utils/data";

async function getDocumentBasicData() {
    const pyEnv = await startServer();
    const documentsFolderId1 = pyEnv["documents.folder"].create({
        name: "Workspace1",
        description: "Workspace",
    });
    const mailAliasId1 = pyEnv["mail.alias"].create({ alias_name: "hazard@rmcf.es" });
    pyEnv["documents.share"].create({
        name: "Share1",
        folder_id: documentsFolderId1,
        alias_id: mailAliasId1,
    });
    pyEnv["spreadsheet.template"].create([
        { name: "Template 1", data: btoa("{}") },
        { name: "Template 2", data: btoa("{}") },
    ]);
    return {
        ...getBasicData(),
        ...pyEnv.getData(),
    };
}

QUnit.module("documents_spreadsheet > create spreadsheet from template modal", {}, () => {
    QUnit.test("Create spreadsheet from kanban view opens a modal", async function (assert) {
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            data: await getDocumentBasicData(),
            arch: /*xml*/ `
            <kanban><templates><t t-name="kanban-box">
                <div><field name="name"/></div>
            </t></templates></kanban>
        `,
            archs: {
                "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
            },
        });
        await click(kanban.el, ".o_documents_kanban_spreadsheet");
        await nextTick();
        assert.ok(
            $(".o-spreadsheet-templates-dialog").length,
            "should have opened the template modal"
        );
        assert.ok(
            $(".o-spreadsheet-templates-dialog .modal-body .o_searchview").length,
            "The Modal should have a search view"
        );
        kanban.destroy();
    });

    QUnit.test("Create spreadsheet from list view opens a modal", async function (assert) {
        const list = await createDocumentsView({
            View: DocumentsListView,
            model: "documents.document",
            data: await getDocumentBasicData(),
            arch: `<tree></tree>`,
            archs: {
                "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
            },
        });
        await click(list.el, ".o_documents_kanban_spreadsheet");
        assert.ok(
            $(".o-spreadsheet-templates-dialog").length,
            "should have opened the template modal"
        );
        assert.ok(
            $(".o-spreadsheet-templates-dialog .modal-body .o_searchview").length,
            "The Modal should have a search view"
        );
        list.destroy();
    });

    QUnit.test("Can search template in modal with searchbar", async function (assert) {
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            data: await getDocumentBasicData(),
            arch: /*xml*/ `
                <kanban><templates><t t-name="kanban-box">
                    <field name="name"/>
                </t></templates></kanban>
            `,
            archs: {
                "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
            },
        });
        await click(kanban.el, ".o_documents_kanban_spreadsheet");
        const dialog = document.querySelector(".o-spreadsheet-templates-dialog");
        assert.equal(dialog.querySelectorAll(".o-template").length, 3);
        assert.equal(dialog.querySelector(".o-template").textContent, "Blank spreadsheet");

        const searchInput = dialog.querySelector(".o_searchview_input");
        await fields.editInput(searchInput, "Template 1");
        await dom.triggerEvent(searchInput, "keydown", { key: "Enter" });
        assert.equal(dialog.querySelectorAll(".o-template").length, 2);
        assert.equal(dialog.querySelector(".o-template").textContent, "Blank spreadsheet");
        kanban.destroy();
    });

    QUnit.test("Can fetch next templates", async function (assert) {
        const data = await getDocumentBasicData();
        data["spreadsheet.template"].records = data["spreadsheet.template"].records.concat([
            { id: 3, name: "Template 3", data: btoa("{}") },
            { id: 4, name: "Template 4", data: btoa("{}") },
            { id: 5, name: "Template 5", data: btoa("{}") },
            { id: 6, name: "Template 6", data: btoa("{}") },
            { id: 7, name: "Template 7", data: btoa("{}") },
            { id: 8, name: "Template 8", data: btoa("{}") },
            { id: 9, name: "Template 9", data: btoa("{}") },
            { id: 10, name: "Template 10", data: btoa("{}") },
            { id: 11, name: "Template 11", data: btoa("{}") },
            { id: 12, name: "Template 12", data: btoa("{}") },
        ]);
        let fetch = 0;
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            data,
            arch: /*xml*/ `
                <kanban><templates><t t-name="kanban-box">
                    <field name="name"/>
                </t></templates></kanban>
            `,
            archs: {
                "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
            },
            mockRPC: function (route, args) {
                if (route === "/web/dataset/search_read" && args.model === "spreadsheet.template") {
                    fetch++;
                    assert.equal(args.limit, 9);
                    assert.step("fetch_templates");
                    if (fetch === 1) {
                        assert.equal(args.offset, undefined);
                    } else if (fetch === 2) {
                        assert.equal(args.offset, 9);
                    }
                }
                if (args.method === "search_read" && args.model === "ir.model") {
                    return Promise.resolve([{ name: "partner" }]);
                }
                return this._super.apply(this, arguments);
            },
        });

        await dom.click(".o_documents_kanban_spreadsheet");
        const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

        assert.equal(dialog.querySelectorAll(".o-template").length, 10);
        await dom.click(dialog.querySelector(".o_pager_next"));
        assert.verifySteps(["fetch_templates", "fetch_templates"]);
        kanban.destroy();
    });

    QUnit.test("Disable create button if no template is selected", async function (assert) {
        assert.expect(2);
        const data = await getDocumentBasicData();
        data["spreadsheet.template"].records = data["spreadsheet.template"].records.concat([
            { id: 3, name: "Template 3", data: btoa("{}") },
            { id: 4, name: "Template 4", data: btoa("{}") },
            { id: 5, name: "Template 5", data: btoa("{}") },
            { id: 6, name: "Template 6", data: btoa("{}") },
            { id: 7, name: "Template 7", data: btoa("{}") },
            { id: 8, name: "Template 8", data: btoa("{}") },
            { id: 9, name: "Template 9", data: btoa("{}") },
            { id: 10, name: "Template 10", data: btoa("{}") },
            { id: 11, name: "Template 11", data: btoa("{}") },
            { id: 12, name: "Template 12", data: btoa("{}") },
        ]);
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            data: data,
            arch: /*xml*/ `
                <kanban><templates><t t-name="kanban-box">
                    <field name="name"/>
                </t></templates></kanban>
            `,
            archs: {
                "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
            },
        });
        // open template dialog
        await dom.click(".o_documents_kanban_spreadsheet");
        const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

        // select template
        await dom.triggerEvent(dialog.querySelectorAll(".o-template img")[1], "focus");

        // change page; no template should be selected
        await dom.click(dialog.querySelector(".o_pager_next"));
        assert.containsNone(dialog, ".o-template-selected");
        const createButton = dialog.querySelector(".o-spreadsheet-create");
        await dom.click(createButton);
        assert.ok(createButton.attributes.disabled);
        kanban.destroy();
    });

    QUnit.test("Can create a blank spreadsheet from template dialog", async function (assert) {
        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv["documents.folder"].create({});
        pyEnv["documents.document"].create({
            name: "My spreadsheet",
            raw: "{}",
            is_favorited: false,
            folder_id: documentsFolderId1,
            handler: "spreadsheet",
        });
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            data: pyEnv.getData(),
            arch: `
            <kanban><templates><t t-name="kanban-box">
                <field name="name"/>
            </t></templates></kanban>
        `,
            archs: {
                "spreadsheet.template,false,search": `<search><field name="name"/></search>`,
            },
            // data: pyEnv.getData(),
            intercepts: {
                do_action: function (ev) {
                    assert.step("redirect");
                    assert.equal(ev.data.action.tag, "action_open_spreadsheet");
                    assert.deepEqual(ev.data.action.params, {
                        alwaysCreate: true,
                        createFromTemplateId: null,
                        createFromTemplateName: undefined,
                        createInFolderId: 1,
                    });
                },
            },
        });

        await dom.click(".o_documents_kanban_spreadsheet");
        const dialog = document.querySelector(".o-spreadsheet-templates-dialog");

        // select blank spreadsheet
        await dom.triggerEvent(dialog.querySelectorAll(".o-template img")[0], "focus");
        await dom.click(dialog.querySelector(".o-spreadsheet-create"));
        assert.verifySteps(["redirect"]);
        kanban.destroy();
    });
});
