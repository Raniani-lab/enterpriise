/** @odoo-module **/

import { patch } from "@web/core/utils/patch";

import {
    RelationalModel,
    Record,
    Group,
    DynamicRecordList,
    DynamicGroupList,
    StaticList,
} from "@web/views/relational_model";
import { DocumentsModelMixin, DocumentsDataPointMixin, DocumentsRecordMixin } from "../documents_model_mixin";

export class DocumentsListModel extends RelationalModel {}

// All datapoint types must extend our mixin
class DocumentsListRecord extends Record {}
class DocumentsListGroup extends Group {}
class DocumentsListDynamicRecordList extends DynamicRecordList {}
class DocumentsListDynamicGroupList extends DynamicGroupList {}
class DocumentsListStaticList extends StaticList {}
patch(DocumentsListRecord.prototype, "documents_list_record", DocumentsRecordMixin);
patch(DocumentsListGroup.prototype, "documents_list_list_group", DocumentsDataPointMixin);
patch(DocumentsListDynamicRecordList.prototype, "documents_list_list_dynamic_record_list", DocumentsDataPointMixin);
patch(DocumentsListDynamicGroupList.prototype, "documents_list_list_dynamic_group_list", DocumentsDataPointMixin);
patch(DocumentsListStaticList.prototype, "documents_list_list_static_list", DocumentsDataPointMixin);
DocumentsListModel.Record = DocumentsListRecord;
DocumentsListModel.Group = DocumentsListGroup;
DocumentsListModel.DynamicRecordList = DocumentsListDynamicRecordList;
DocumentsListModel.DynamicGroupList = DocumentsListDynamicGroupList;
DocumentsListModel.StaticList = DocumentsListStaticList;

patch(DocumentsListModel.prototype, "documents_list_model", DocumentsModelMixin);
