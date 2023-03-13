/** @odoo-module **/

import { patch } from '@web/core/utils/patch';

import { GridTimesheetTimerHeader } from '@timesheet_grid/components/grid_timesheet_timer_header/grid_timesheet_timer_header';

patch(GridTimesheetTimerHeader.prototype, 'helpdesk_timesheet.GridTimesheetTimerHeader', {
    /**
     * @override
     */
    get fieldNames() {
        return [...this._super(), 'helpdesk_ticket_id'];
    },
});
