/** @odoo-module **/

import { AttendeeCalendarRenderer } from 'calendar.CalendarRenderer';

AttendeeCalendarRenderer.include({
    events: Object.assign({}, AttendeeCalendarRenderer.prototype.events, {
        'click .o_appointment_search_create_work_hours_appointment': '_onSearchCreateWorkHoursAppointment',
    }),
    /**
     * Add data to dynamically show / hide 'work hours' button in the dropdown.
     * @override
     */
     _prepareAppointmentButtonsTemplateContext() {
        let data = this._super(...arguments);
        data.context_user_has_employee = this.state.contextUserHasEmployee;
        return data;
    },
    /**
     * Used when clicking on the Work Hours appointment type in the dropdown.
     * We display an info box to the user to let them know that the url was copied
     * and that it allows them to recopy it until they close the box
     * @param {Event} ev
     */
     _onSearchCreateWorkHoursAppointment(ev) {
        ev.stopPropagation();
        this.trigger_up('search_create_work_hours_appointment_type', ev);
        this._onChangeDisplay(ev);
    },
});
