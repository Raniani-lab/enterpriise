/** @odoo-module */

import { patch } from "@web/core/utils/patch";

import { TimesheetOvertimeIndication } from "@timesheet_grid/components/timesheet_overtime_indication/timesheet_overtime_indication";

patch(
    TimesheetOvertimeIndication.prototype,
    {
        get title() {
            if (this.props.name === "project_id") {
                return this.env._t(
                    "Difference between the number of %s ordered on the sales order item and the number of %s delivered",
                    this.props.planned_hours,
                    this.props.worked_hours
                );
            }
            return super.title;
        },
    }
);
