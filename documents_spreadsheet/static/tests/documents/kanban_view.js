/** @odoo-module */

import { dom } from "web.test_utils";
import { createDocumentsView } from "@documents/../tests/documents_test_utils";
import { startServer } from "@mail/../tests/helpers/test_utils";
import {
    click,
    getFixture,
    patchWithCleanup,
} from '@web/../tests/helpers/utils';
import { setupViewRegistries } from "@web/../tests/views/helpers";
import { registry } from '@web/core/registry';
import { documentsFileUploadService } from '@documents/views/helper/documents_file_upload_service';

const find = dom.find;
const serviceRegistry = registry.category("services");

let target;

QUnit.module("documents_spreadsheet kanban", {
    beforeEach() {
        setupViewRegistries();
        target = getFixture();
        serviceRegistry.add("documents_file_upload", documentsFileUploadService);
    },
}, () => {
    QUnit.test("download spreadsheet from the document inspector", async function (assert) {
        assert.expect(3);
        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv["documents.folder"].create({ display_name: "Workspace1", has_write_access: true });
        const documentsDocumentId1 = pyEnv["documents.document"].create({
            name: "My spreadsheet",
            raw: "{}",
            is_favorited: false,
            folder_id: documentsFolderId1,
            handler: "spreadsheet",
        });
        const kanban = await createDocumentsView({
            type: "kanban",
            resModel: "documents.document",
            arch: `
              <kanban js_class="documents_kanban"><templates><t t-name="kanban-box">
                  <div>
                      <i class="fa fa-circle-thin o_record_selector"/>
                      <field name="name"/>
                      <field name="handler"/>
                  </div>
              </t></templates></kanban>`,
              serverData: { models: pyEnv.getData(), views: {} },
        });

        patchWithCleanup(kanban.env.services.action, {
            doAction(action) {
                assert.step("redirect_to_spreadsheet");
                assert.deepEqual(action, {
                    type: "ir.actions.client",
                    tag: "action_open_spreadsheet",
                    params: {
                        spreadsheet_id: documentsDocumentId1,
                        download: true,
                    },
                });
            },
        });
        await click(target, ".o_kanban_record:nth-of-type(1) .o_record_selector");
        await click(target, "button.o_inspector_download");
        assert.verifySteps(["redirect_to_spreadsheet"]);
    });

    QUnit.test("thumbnail size in document side panel", async function (assert) {
        assert.expect(9);
        const pyEnv = await startServer();
        const documentsFolderId1 = pyEnv["documents.folder"].create({ display_name: "Workspace1", has_write_access: true });
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
        await createDocumentsView({
            type: "kanban",
            resModel: "documents.document",
            arch: `
              <kanban js_class="documents_kanban"><templates><t t-name="kanban-box">
                  <div>
                      <i class="fa fa-circle-thin o_record_selector"/>
                      <field name="name"/>
                      <field name="handler"/>
                  </div>
              </t></templates></kanban>
          `,
          serverData: { models: pyEnv.getData(), views: {} },
        });
        await click(target, ".o_kanban_record:nth-of-type(1) .o_record_selector");
        assert.containsOnce(target, ".o_documents_inspector_preview .o_document_preview");
        assert.equal(
            find(target, ".o_documents_inspector_preview .o_document_preview img").dataset.src,
            "/documents/image/1/268x130?field=thumbnail&unique="
        );
        await click(target, ".o_kanban_record:nth-of-type(2) .o_record_selector");
        assert.containsN(target, ".o_documents_inspector_preview .o_document_preview", 2);
        let previews = target.querySelectorAll(
            ".o_documents_inspector_preview .o_document_preview img"
        );
        assert.equal(previews[0].dataset.src, "/documents/image/1/120x130?field=thumbnail&unique=");
        assert.equal(previews[1].dataset.src, "/documents/image/2/120x130?field=thumbnail&unique=");
        await click(target, ".o_kanban_record:nth-of-type(3) .o_record_selector");
        assert.containsN(target, ".o_documents_inspector_preview .o_document_preview", 3);
        previews = target.querySelectorAll(
            ".o_documents_inspector_preview .o_document_preview img"
        );
        assert.equal(previews[0].dataset.src, "/documents/image/1/120x75?field=thumbnail&unique=");
        assert.equal(previews[1].dataset.src, "/documents/image/2/120x75?field=thumbnail&unique=");
        assert.equal(previews[2].dataset.src, "/documents/image/3/120x75?field=thumbnail&unique=");
    });
});
