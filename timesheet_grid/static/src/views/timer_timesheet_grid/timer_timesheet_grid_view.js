/** @odoo-module */

import { registry } from "@web/core/registry";

import { timesheetGridView } from "../timesheet_grid/timesheet_grid_view";
import { TimerTimesheetGridModel } from "./timer_timesheet_grid_model";
import { TimerTimesheetGridRenderer } from "./timer_timesheet_grid_renderer";

export const timerTimesheetGridView = {
    ...timesheetGridView,
    Model: TimerTimesheetGridModel,
    Renderer: TimerTimesheetGridRenderer,
};

registry.category('views').add('new_timer_timesheet_grid', timerTimesheetGridView);
