/** @odoo-module */

import { Domain } from "@web/core/domain";
import { patch } from "@web/core/utils/patch";
import { TimesheetGridDataPoint } from "@timesheet_grid/views/timesheet_grid/timesheet_grid_model";

patch(TimesheetGridDataPoint.prototype, "timesheet_grid_holidays.TimesheetGridDataPoint", {
    /**
     * @override
     */
    _getPreviousWeekTimesheetDomain() {
        return Domain.and([this._super(), ["|", ["task_id.is_timeoff_task", "=", false], ["task_id", "=", false]]]);
    },

    /**
     * @override
     */
    _getFavoriteTaskDomain() {
        return Domain.and([this._super(), [["is_timeoff_task", "=", false]]]);
    },
});
