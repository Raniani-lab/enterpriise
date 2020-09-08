/** @odoo-module */

import { nextTick, dom } from "web.test_utils";
import DocumentsKanbanView from "documents_spreadsheet.KanbanView";
import { createDocumentsView } from "documents.test_utils";
import { startServer } from "@mail/../tests/helpers/test_utils";

QUnit.module("documents_spreadsheet kanban", {}, () => {
    QUnit.test("download spreadsheet from the document inspector", async function (assert) {
        assert.expect(3);
        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv["documents.folder"].create({has_write_access: true});
        const documentsDocumentId1 = pyEnv["documents.document"].create({
            name: "My spreadsheet",
            raw: "{}",
            is_favorited: false,
            folder_id: documentsFolderId1,
            handler: "spreadsheet",
        });
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            arch: `
              <kanban><templates><t t-name="kanban-box">
                  <div>
                      <i class="fa fa-circle-thin o_record_selector"/>
                      <field name="name"/>
                      <field name="handler"/>
                  </div>
              </t></templates></kanban>
          `,
            data: pyEnv.getData(),
            intercepts: {
                do_action: function ({ data }) {
                    assert.step("redirect_to_spreadsheet");
                    assert.deepEqual(data.action, {
                        type: "ir.actions.client",
                        tag: "action_open_spreadsheet",
                        params: {
                            spreadsheet_id: documentsDocumentId1,
                            download: true,
                        },
                    });
                },
            },
        });
        await dom.click(".o_kanban_record:nth(0) .o_record_selector");
        await nextTick();
        await dom.click("button.o_inspector_download");
        await nextTick();
        assert.verifySteps(["redirect_to_spreadsheet"]);
        kanban.destroy();
    });

    QUnit.test("thumbnail size in document side panel", async function (assert) {
        assert.expect(9);
        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv["documents.folder"].create({has_write_access: true});
        pyEnv["documents.document"].create([
            {
                name: "My spreadsheet",
                raw: "{}",
                is_favorited: false,
                folder_id: documentsFolderId1,
                handler: "spreadsheet",
            },
            {
                name: "",
                raw: "{}",
                is_favorited: true,
                folder_id: documentsFolderId1,
                handler: "spreadsheet",
            },
            {
                name: "",
                raw: "{}",
                folder_id: documentsFolderId1,
                handler: "spreadsheet",
            },
        ]);
        const kanban = await createDocumentsView({
            View: DocumentsKanbanView,
            model: "documents.document",
            arch: `
              <kanban><templates><t t-name="kanban-box">
                  <div>
                      <i class="fa fa-circle-thin o_record_selector"/>
                      <field name="name"/>
                      <field name="handler"/>
                  </div>
              </t></templates></kanban>
          `,
            data: pyEnv.getData(),
        });
        await dom.click(".o_kanban_record:nth(0) .o_record_selector");
        await nextTick();
        assert.containsOnce(kanban, ".o_documents_inspector_preview .o_document_preview");
        assert.equal(
            dom.find(kanban, ".o_documents_inspector_preview .o_document_preview img").dataset.src,
            "/documents/image/1/268x130?field=thumbnail&unique="
        );
        await dom.click(".o_kanban_record:nth(1) .o_record_selector");
        await nextTick();
        assert.containsN(kanban, ".o_documents_inspector_preview .o_document_preview", 2);
        let previews = kanban.el.querySelectorAll(
            ".o_documents_inspector_preview .o_document_preview img"
        );
        assert.equal(previews[0].dataset.src, "/documents/image/1/120x130?field=thumbnail&unique=");
        assert.equal(previews[1].dataset.src, "/documents/image/2/120x130?field=thumbnail&unique=");
        await dom.click(".o_kanban_record:nth(2) .o_record_selector");
        await nextTick();
        assert.containsN(kanban, ".o_documents_inspector_preview .o_document_preview", 3);
        previews = kanban.el.querySelectorAll(
            ".o_documents_inspector_preview .o_document_preview img"
        );
        assert.equal(previews[0].dataset.src, "/documents/image/1/120x75?field=thumbnail&unique=");
        assert.equal(previews[1].dataset.src, "/documents/image/2/120x75?field=thumbnail&unique=");
        assert.equal(previews[2].dataset.src, "/documents/image/3/120x75?field=thumbnail&unique=");
        kanban.destroy();
    });
});
