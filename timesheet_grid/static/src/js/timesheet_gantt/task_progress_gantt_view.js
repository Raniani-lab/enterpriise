/** @odoo-module **/

import WebGanttRow from 'web_gantt.GanttRow';
import TaskGanttConnectorRow from '@project_enterprise/js/task_gantt_connector/task_gantt_connector_row';
import { ProjectGanttRenderer } from '@project_enterprise/js/task_gantt_view';
import fieldUtils from 'web.field_utils';

const TimesheetGridTaskGanttRowOverride = {
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
};

const TimesheetGridTaskGanttRow = WebGanttRow.extend(
    Object.assign(
        {},
        TimesheetGridTaskGanttRowOverride,
        {template: 'TimesheetGridTaskGanttView.Row'}
    )
);

const TimesheetGridTaskGanttConnectorRow = TaskGanttConnectorRow.include(TimesheetGridTaskGanttRowOverride);

ProjectGanttRenderer.include({
    config: Object.assign({}, ProjectGanttRenderer.prototype.config, {
        GanttRow: TimesheetGridTaskGanttRow,
    }),
});
