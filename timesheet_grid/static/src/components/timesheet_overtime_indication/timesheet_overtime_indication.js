/** @odoo-module */

import { sprintf } from "@web/core/utils/strings";

import { EmployeeOvertimeIndication } from "../employee_overtime_indication/employee_overtime_indication";

export class TimesheetOvertimeIndication extends EmployeeOvertimeIndication {
    static template = "timesheet_grid.TimesheetOvertimeIndication";
    static props = {
        ...EmployeeOvertimeIndication.props,
        name: String,
    };

    get colorClasses() {
        if (!this.shouldShowHours) {
            return "";
        }
        const progression = this.props.worked_hours / this.props.planned_hours;
        return progression <= 0.8
            ? "text-success"
            : progression <= 0.99
            ? "text-warning"
            : "text-danger";
    }

    get overtime() {
        return this.props.planned_hours - this.props.worked_hours;
    }

    get title() {
        if (this.props.name === "project_id") {
            return sprintf(
                this.env._t(
                    "Difference between the number of %s allocated to the project and the number of %s recorded"
                ),
                this.props.planned_hours,
                this.props.worked_hours
            );
        } else if (this.props.name === "task_id") {
            return sprintf(
                this.env._t(
                    "Difference between the number of %s allocated to the task and the number of %s recorded"
                ),
                this.props.planned_hours,
                this.props.worked_hours
            );
        } else {
            return this.env._t("Difference between the time allocated and the time recorded");
        }
    }
}
