/** @odoo-module */

import { ListRenderer } from "@web/views/list/list_renderer";
import { TimesheetTimerHeader } from "@timesheet_grid/components/timesheet_timer_header/timesheet_timer_header";
import { useTimesheetTimerRendererHook } from "@timesheet_grid/hooks/timesheet_timer_hooks";

export class TimesheetTimerListRenderer extends ListRenderer {
    setup() {
        super.setup();
        this.timesheetTimerRendererHook = useTimesheetTimerRendererHook();
    }
}

TimesheetTimerListRenderer.template = "timesheet_grid.TimesheetTimerListRenderer";

TimesheetTimerListRenderer.components = {
    ...ListRenderer.components,
    TimesheetTimerHeader: TimesheetTimerHeader,
};
