/** @odoo-module **/

import { TimeOffToDeferWarning, useTimeOffToDefer } from "@hr_payroll_holidays/views/hooks";
import { WorkEntryCalendarController } from "@hr_work_entry_contract/views/work_entry_calendar/work_entry_calendar_controller";
import { patch } from "@web/core/utils/patch";

patch(
    WorkEntryCalendarController.prototype,
    "hr_payroll_holidays.work_entries_calendar.prototype",
    {
        setup() {
            this._super(...arguments);
            this.timeOff = useTimeOffToDefer();
        },
    }
);
patch(WorkEntryCalendarController, "hr_payroll_holidays.work_entries_calendar", {
    template: "hr_payroll_holidays.WorkEntryCalendarController",
    components: { ...WorkEntryCalendarController.components, TimeOffToDeferWarning },
});
