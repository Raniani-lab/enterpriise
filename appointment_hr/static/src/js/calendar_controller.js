/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import CalendarController from 'calendar.CalendarController';

CalendarController.include({
    custom_events: Object.assign({}, CalendarController.prototype.custom_events, {
        'search_create_work_hours_appointment_type': '_onSearchCreateWorkHoursAppointment',
    }),
    /**
     * Search/create the work hours appointment type of the user when
     * he clicks on the button "Work Hours".
     * @param {Event} ev
     */
    async _onSearchCreateWorkHoursAppointment(ev) {
        const workHoursAppointment = await this._rpc({
            route: '/appointment/appointment_type/search_create_work_hours',
        });
        if (workHoursAppointment.appointment_type_id) {
            browser.navigator.clipboard.writeText(workHoursAppointment.invite_url);
            this.lastAppointmentURL = workHoursAppointment.invite_url;
        }
    },
});
