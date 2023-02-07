/** @odoo-module */

import { registry } from "@web/core/registry";
import { Many2OneField, many2OneField } from "@web/views/fields/many2one/many2one_field";
import { TimesheetOvertimeIndication } from "../timesheet_overtime_indication/timesheet_overtime_indication";
import { useTimesheetOvertimeProps } from "../../hooks/useTimesheetOvertimeProps";

export class TimesheetGridMany2OneField extends Many2OneField {
    static template = "timesheet_grid.TimesheetGridMany2OneField";

    static components = {
        ...Many2OneField.components,
        TimesheetOvertimeIndication,
    };

    static props = {
        ...Many2OneField.props,
        workingHours: { type: Object, optional: true },
    };

    setup() {
        super.setup(...arguments);
        this.timesheetOvertimeProps = useTimesheetOvertimeProps();
    }

    get overtimeProps() {
        return {
            ...this.timesheetOvertimeProps.props,
            name: this.props.name,
        };
    }
}

export const timesheetGridMany2OneField = {
    ...many2OneField,
    component: TimesheetGridMany2OneField,
};

registry.category("fields").add("timesheet_many2one", timesheetGridMany2OneField);
