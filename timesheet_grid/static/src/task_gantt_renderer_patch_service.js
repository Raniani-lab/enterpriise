/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { TaskGanttRenderer } from "@project_enterprise/task_gantt_renderer";
import fieldUtils from "web.field_utils";

patch(TaskGanttRenderer.prototype, "task_gantt_renderer_patch_service", {
    getPopoverProps(pill) {
        const props = this._super(...arguments);
        const ctx = props.context;
        const { record } = pill;
        if (ctx.allow_subtasks) {
            ctx.total_hours_spent_formatted = fieldUtils.format.timesheet_uom(
                record.total_hours_spent
            );
        } else {
            ctx.effective_hours_formatted = fieldUtils.format.timesheet_uom(record.effective_hours);
        }
        ctx.progressFormatted = Math.round(record.progress);
        return props;
    },
});
