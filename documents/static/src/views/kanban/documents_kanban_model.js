/** @odoo-module **/

import { patch } from "@web/core/utils/patch";

import session from "web.session";
import { KanbanModel, KanbanDynamicGroupList, KanbanDynamicRecordList } from "@web/views/kanban/kanban_model";
import { StaticList } from "@web/views/relational_model";
import { DocumentsModelMixin, DocumentsDataPointMixin, DocumentsRecordMixin } from "../documents_model_mixin";

export class DocumentsKanbanModel extends KanbanModel {}

export class DocumentsKanbanRecord extends KanbanModel.Record {
    async onClickPreview(ev) {
        if (this.data.type === "empty") {
            // In case the file is actually empty we open the input to replace the file
            ev.stopPropagation();
            ev.currentTarget.querySelector(".o_kanban_replace_document").click();
        } else if (this.isViewable()) {
            ev.stopPropagation();
            ev.preventDefault();
            const folder = this.model.env.searchModel
                .getFolders()
                .filter((folder) => folder.id === this.data.folder_id[0]);
            const hasPdfSplit =
                (!this.data.lock_uid || this.data.lock_uid[0] === session.uid) && folder.has_write_access;
            await this.model.env.bus.trigger("documents-open-preview", {
                documents: [this],
                isPdfSplit: false,
                rules: this.data.available_rule_ids.records,
                hasPdfSplit,
            });
        }
    }

    async onReplaceDocument(ev) {
        if (!ev.target.files.length) {
            return;
        }
        await this.model.env.bus.trigger("documents-upload-files", {
            files: ev.target.files,
            folderId: this.data.folder_id && this.data.folder_id[0],
            recordId: this.resId,
            params: {
                tagIds: this.model.env.searchModel.getSelectedTagIds(),
            },
        });
        ev.target.value = "";
    }
}
class DocumentsKanbanGroup extends KanbanModel.Group {}
class DocumentsKanbanDynamicGroupList extends KanbanDynamicGroupList {}
class DocumentsKanbanDynamicRecordList extends KanbanDynamicRecordList {}
class DocumentsKanbanStaticList extends StaticList {}
patch(DocumentsKanbanRecord.prototype, "documents_kanban_kanban_record", DocumentsRecordMixin);
patch(DocumentsKanbanGroup.prototype, "documents_kanban_kanban_group", DocumentsDataPointMixin);
patch(DocumentsKanbanDynamicGroupList.prototype, "documents_kanban_kanban_dynamic_group_list", DocumentsDataPointMixin);
patch(
    DocumentsKanbanDynamicRecordList.prototype,
    "documents_kanban_kanban_dynamic_record_list",
    DocumentsDataPointMixin
);
patch(DocumentsKanbanStaticList.prototype, "documents_kanban_kanban_static_list", DocumentsDataPointMixin);
DocumentsKanbanModel.Record = DocumentsKanbanRecord;
DocumentsKanbanModel.Group = DocumentsKanbanGroup;
DocumentsKanbanModel.DynamicGroupList = DocumentsKanbanDynamicGroupList;
DocumentsKanbanModel.DynamicRecordList = DocumentsKanbanDynamicRecordList;
DocumentsKanbanModel.StaticList = DocumentsKanbanStaticList;

patch(DocumentsKanbanModel.prototype, "documents_kanban_model", DocumentsModelMixin);
