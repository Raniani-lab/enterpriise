/** @odoo-module **/

import { AttendeeCalendarRenderer } from 'calendar.CalendarRenderer';

AttendeeCalendarRenderer.include({
    /**
     * Add the opportunity name from which the user came from if
     * there is one
     * @override
     */
    _prepareAppointmentButtonsTemplateContext() {
        let result = this._super(...arguments);
        if (!!this.state.context.default_opportunity_id) {
            result['opportunity_name'] = this.state.context.default_name;
        }
        return result;
    }
});
