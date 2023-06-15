/** @odoo-module **/

import { Domain } from "@web/core/domain";
import { GanttModel } from "@web_gantt/gantt_model";

export class AppointmentBookingGanttModel extends GanttModel {
    /**
     *
     * @override
     */
    _fetchData() {
        // add some context keys to the search
        Object.assign(this.searchParams.context, {
            'appointment_booking_gantt_show_all_resources': true
        });
        return super._fetchData(...arguments);
    }
}
