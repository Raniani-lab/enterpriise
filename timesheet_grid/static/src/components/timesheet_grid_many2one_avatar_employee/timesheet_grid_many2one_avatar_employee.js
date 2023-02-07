/** @odoo-module */

import { registry } from "@web/core/registry";
import {
    Many2OneAvatarEmployeeField,
    many2OneAvatarEmployeeField,
} from "@hr/views/fields/many2one_avatar_employee_field/many2one_avatar_employee_field";
import { EmployeeOvertimeIndication } from "../employee_overtime_indication/employee_overtime_indication";
import { useTimesheetOvertimeProps } from "../../hooks/useTimesheetOvertimeProps";

export class TimesheetGridMany2OneAvatarEmployeeField extends Many2OneAvatarEmployeeField {
    static template = "TimesheetGridMany2OneAvatarEmployeeField";

    static components = {
        ...Many2OneAvatarEmployeeField.components,
        EmployeeOvertimeIndication,
    };

    static props = {
        ...Many2OneAvatarEmployeeField.props,
        workingHours: { type: Object, optional: true },
    };

    setup() {
        super.setup(...arguments);
        this.employeeOvertimeProps = useTimesheetOvertimeProps();
    }

    get timesheetOvertimeProps() {
        const { units_to_work, uom, worked_hours } = this.employeeOvertimeProps.props;
        const timesheetOvertimeProps = {
            planned_hours: units_to_work,
            uom,
            worked_hours,
        };
        return timesheetOvertimeProps;
    }
}

export const timesheetGridMany2OneAvatarEmployeeField = {
    ...many2OneAvatarEmployeeField,
    component: TimesheetGridMany2OneAvatarEmployeeField,
};

registry
    .category("fields")
    .add("timesheet_many2one_avatar_employee", timesheetGridMany2OneAvatarEmployeeField);
