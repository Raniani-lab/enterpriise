/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { TaskGanttRenderer } from "@project_enterprise/task_gantt_renderer";
import fieldUtils from "web.field_utils";

patch(TaskGanttRenderer.prototype, "task_gantt_renderer_patch_service", {
    getPopoverProps(pill) {
        const props = this._super(...arguments);
        const ctx = props.context;
        const { record } = pill;
        ctx.total_hours_spent_formatted = fieldUtils.format.timesheet_uom(
            record.total_hours_spent
        );
        ctx.progressFormatted = Math.round(record.progress);
        return props;
    },
});
