/** @odoo-module **/

import { TaskGanttRenderer } from '@project_enterprise/task_gantt_renderer';
import { patch } from "@web/core/utils/patch";

const { DateTime } = luxon;

patch(TaskGanttRenderer.prototype, {
    /**
     * @override
    */
    onCreate() {
        const { context } = this.model.searchParams;
        const { startDate, stopDate } = this.model.metaData;
        const today = DateTime.local().startOf("day");
        // similar to what is found in planning_gantt_controller.js but different
        // --> unify?
        if (context.fsm_mode && startDate <= today.endOf("day") && today <= stopDate) {
            const stop = today.endOf("day");
            const context = this.model.getDialogContext({ start: today, stop, withDefault: true });
            this.props.create(context);
            return;
        }
        super.onCreate(...arguments);
    },
});
