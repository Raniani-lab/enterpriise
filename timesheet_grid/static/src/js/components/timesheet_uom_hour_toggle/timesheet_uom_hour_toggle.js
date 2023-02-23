/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

import { TimerToggleButton } from "@timer/component/timer_toggle_button/timer_toggle_button";
import { TimesheetDisplayTimer } from "../timesheet_display_timer/timesheet_display_timer";


const { Component } = owl;

export class FieldTimesheetHourToggle extends Component {

    setup() {
        super.setup();
        this.ormService = useService("orm");
    }

    async _performActionAndReload(action) {
        await this.ormService.call(this.props.record.resModel, action, [[this.props.record.resId]]);
        await this.props.record.load();
        this.props.record.model.notify();
    }

    async onClickDecrease() {
        await this._performActionAndReload("action_timer_decrease");
    }

    async onClickIncrease() {
        await this._performActionAndReload("action_timer_increase");
    }

    get TimesheetDisplayTimerProps() {
        const { record, readonly } = this.props;
        return {
            record,
            readonly,
            name: "duration_unit_amount",
        };
    }

    get TimerToggleButtonProps() {
        const { record, readonly } = this.props;
        return {
            record,
            readonly,
            name: "is_timer_running",
        };
    }

}

FieldTimesheetHourToggle.template = "timesheet_grid.TimesheetUOMHoursToggle";

FieldTimesheetHourToggle.components = { TimesheetDisplayTimer, TimerToggleButton };

FieldTimesheetHourToggle.props = {
    ...standardFieldProps,
};

export const fieldTimesheetHourToggle = {
    component: FieldTimesheetHourToggle,
    fieldDependencies: [
        { name: "duration_unit_amount", type: "float" },
        { name: "is_timer_running", type: "boolean" },
    ],
};

registry.category("fields").add("timesheet_uom_hour_toggle", fieldTimesheetHourToggle);
