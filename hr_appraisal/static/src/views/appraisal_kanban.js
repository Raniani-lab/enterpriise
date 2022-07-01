/** @odoo-module */

import { registry } from '@web/core/registry';
import { patch } from '@web/core/utils/patch';

import { kanbanView } from '@web/views/kanban/kanban_view';
import { KanbanModel } from '@web/views/kanban/kanban_model';

import { EmployeeChatMixin } from '@hr/mixins/chat_mixin';

export class AppraisalKanbanModel extends KanbanModel {}

export class AppraisalKanbanRecord extends KanbanModel.Record {}
patch(AppraisalKanbanRecord.prototype, 'appraisal_kanban_record_mixin', EmployeeChatMixin);
AppraisalKanbanModel.Record = AppraisalKanbanRecord;

registry.category('views').add('appraisal_kanban', {
    ...kanbanView,
    Model: AppraisalKanbanModel,
});
