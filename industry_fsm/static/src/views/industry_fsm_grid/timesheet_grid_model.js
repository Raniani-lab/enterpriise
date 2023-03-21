/** @odoo-module */

import { Domain } from "@web/core/domain";
import { patch } from "@web/core/utils/patch";
import { TimesheetGridDataPoint } from "@timesheet_grid/views/timesheet_grid/timesheet_grid_model";

patch(TimesheetGridDataPoint.prototype, "industry_fsm.TimesheetGridDataPoint", {
    /**
     * @override
     */
    _getPreviousWeekTimesheetDomain() {
        return Domain.and([this._super(), [["project_id.is_fsm", "=", false]]]);
    },
});
