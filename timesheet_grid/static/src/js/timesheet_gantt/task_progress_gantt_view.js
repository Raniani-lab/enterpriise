/** @odoo-module **/

import WebGanttRow from 'web_gantt.GanttRow';
import { ProjectGanttRenderer } from '@project_enterprise/js/task_gantt_view';
import fieldUtils from 'web.field_utils';

const TaskGanttRow = WebGanttRow.extend({
    template: 'TaskGanttView.Row',

    _getPopoverContext: function () {
        const data = this._super.apply(this, arguments);
        if (data.allow_subtasks) {
            data.total_hours_spent_formatted = fieldUtils.format.timesheet_uom(data.total_hours_spent);
        } else {
            data.effective_hours_formatted = fieldUtils.format.timesheet_uom(data.effective_hours);
        }
        data.progressFormatted = Math.round(data.progress);
        return data;
    },
});

ProjectGanttRenderer.include({
    config: Object.assign({}, ProjectGanttRenderer.prototype.config, {
        GanttRow: TaskGanttRow,
    }),
});
