/** @odoo-module **/

import { ActivityModel } from "@mail/views/web/activity/activity_model";
import { DocumentsDataPointMixin, DocumentsModelMixin, DocumentsRecordMixin } from "../documents_model_mixin";

export class DocumentsActivityModel extends DocumentsModelMixin(ActivityModel) {}

DocumentsActivityModel.Record = class DocumentsActivityRecord extends DocumentsRecordMixin(ActivityModel.Record) {};
DocumentsActivityModel.Group = class DocumentsActivityGroup extends DocumentsDataPointMixin(ActivityModel.Group) {};
DocumentsActivityModel.DynamicGroupList = class DocumentsActivityDynamicGroupList extends DocumentsDataPointMixin(ActivityModel.DynamicGroupList) {};
DocumentsActivityModel.DynamicRecordList = class DocumentsActivityDynamicRecordList extends DocumentsDataPointMixin(ActivityModel.DynamicRecordList) {};
DocumentsActivityModel.StaticList = class DocumentsActivityStaticList extends DocumentsDataPointMixin(ActivityModel.StaticList) {};

